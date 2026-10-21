import assert from "node:assert/strict";
import test from "node:test";

import {
    createVoiceController,
    prepararTextoParaVoz
} from "../modules/voice-controller.js";
import { falarComVozLocal } from "../modules/voice.js";

test("prepares supported date formats for speech", () => {

    assert.equal(
        prepararTextoParaVoz(
            "Agenda: 2026-10-16, 16/10/2026 e 16-10-2026."
        ),
        "Agenda: 16 de outubro de 2026, 16 de outubro de 2026 e 16 de outubro de 2026."
    );

    assert.equal(
        prepararTextoParaVoz("Data inválida: 2026-13-16."),
        "Data inválida: 2026-13-16."
    );
});

test("voice controller respects disabled and suppressed states and releases audio URLs", async () => {

    let requests = 0;
    let player;
    const revokedUrls = [];
    const errors = [];
    const controller = createVoiceController({
        button: null,
        windowRef: {},
        async fetcher() {

            requests += 1;

            return {
                ok: true,
                async blob() {
                    return { size: 1 };
                }
            };
        },
        audioConstructor() {
            player = {
                volume: 0,
                async play() {}
            };

            return player;
        },
        urlApi: {
            createObjectURL() {
                return "blob:lia-audio";
            },
            revokeObjectURL(url) {
                revokedUrls.push(url);
            }
        },
        logger: {
            log() {},
            warn() {},
            error(...args) {
                errors.push(args);
            }
        }
    });

    controller.alternarAtivacao();
    await controller.falar("Olá.");
    assert.equal(requests, 0);

    controller.alternarAtivacao();
    controller.definirSupressao(true);
    await controller.falar("Olá.");
    assert.equal(requests, 0);

    controller.definirSupressao(false);
    await controller.falar("Olá.");

    assert.equal(requests, 1);
    assert.deepEqual(errors, []);
    assert.equal(player.volume, 1);
    player.onended();
    assert.deepEqual(revokedUrls, ["blob:lia-audio"]);
});

test("responses longer than the old local-speech cutoff still use neural voice", async () => {

    let requestBody;
    const controller = createVoiceController({
        button: null,
        windowRef: {},
        async fetcher(url, options) {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                async blob() {
                    return { size: 1 };
                }
            };
        },
        audioConstructor() {
            return {
                volume: 0,
                async play() {}
            };
        },
        urlApi: {
            createObjectURL() {
                return "blob:lia-audio";
            },
            revokeObjectURL() {}
        },
        logger: {
            log() {},
            warn() {},
            error() {}
        }
    });

    const texto = "a".repeat(221);
    await controller.falar(texto);

    assert.equal(requestBody.texto, texto);
});

test("local voice prefers a Brazilian Portuguese system voice", () => {

    let utterance;
    const vozBrasileira = { lang: "pt-BR" };
    const vozPortuguesa = { lang: "pt-PT" };
    const speechSynthesis = {
        cancel() {},
        getVoices() {
            return [vozPortuguesa, vozBrasileira];
        },
        speak(fala) {
            utterance = fala;
        }
    };
    class FakeUtterance {
        constructor(texto) {
            this.text = texto;
        }
    }
    const windowRef = {
        speechSynthesis,
        SpeechSynthesisUtterance: FakeUtterance
    };

    falarComVozLocal("Olá, tudo bem?", windowRef);

    assert.equal(utterance.lang, "pt-BR");
    assert.equal(utterance.voice, vozBrasileira);
    assert.equal(utterance.rate, 1);
    assert.equal(utterance.pitch, 1);
});
