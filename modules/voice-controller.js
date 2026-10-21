import {
    atualizarEstadoVozLia,
    falarComVozLocal,
    pararVozLia
} from "./voice.js";

const LIMITE_TEXTO_VOZ_NEURAL = 1000;

export function prepararTextoParaVoz(texto) {

    if (!texto) {
        return "";
    }

    const meses = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro"
    ];

    return String(texto)
        .replace(
            /\b(\d{4})-(\d{2})-(\d{2})\b/g,
            (match, ano, mes, dia) => {

                const numeroMes = Number(mes);

                if (numeroMes < 1 || numeroMes > 12) {
                    return match;
                }

                return `${Number(dia)} de ${meses[numeroMes - 1]} de ${ano}`;
            }
        )
        .replace(
            /\b(\d{2})\/(\d{2})\/(\d{4})\b/g,
            (match, dia, mes, ano) => {

                const numeroMes = Number(mes);

                if (numeroMes < 1 || numeroMes > 12) {
                    return match;
                }

                return `${Number(dia)} de ${meses[numeroMes - 1]} de ${ano}`;
            }
        )
        .replace(
            /\b(\d{2})-(\d{2})-(\d{4})\b/g,
            (match, dia, mes, ano) => {

                const numeroMes = Number(mes);

                if (numeroMes < 1 || numeroMes > 12) {
                    return match;
                }

                return `${Number(dia)} de ${meses[numeroMes - 1]} de ${ano}`;
            }
        );
}

export function createVoiceController({
    button,
    fetcher = fetch,
    windowRef = window,
    mediaSourceConstructor = globalThis.MediaSource,
    audioConstructor = (...args) => new Audio(...args),
    urlApi = URL,
    logger = console
}) {

    let audioAtual = null;
    let urlAudioAtual = null;
    let vozAtiva = true;
    let vozSuprimida = false;
    let processamentoEmAndamento = false;

    function atualizarBotao() {
        atualizarEstadoVozLia({
            btnToggleVoz: button,
            vozAtiva
        });
    }

    function parar() {

        const resultado = pararVozLia({
            audioLiaAtual: audioAtual,
            urlAudioLiaAtual: urlAudioAtual,
            windowRef
        });

        audioAtual = resultado.audioLiaAtual;
        urlAudioAtual = resultado.urlAudioLiaAtual;
    }

    async function falar(texto, estadoEmocional = "neutro") {

        if (!vozAtiva || vozSuprimida || !texto) {
            return;
        }

        const textoPreparado = prepararTextoParaVoz(
            String(texto).trim()
        );

        if (!textoPreparado) {
            return;
        }

        if (textoPreparado.length > LIMITE_TEXTO_VOZ_NEURAL) {
            falarComVozLocal(textoPreparado, windowRef);
            return;
        }

        if (processamentoEmAndamento) {
            return;
        }

        processamentoEmAndamento = true;

        try {

            logger.log("Solicitando voz neural da LIA...");
            parar();

            const resposta = await fetcher("/api/voz", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    texto: textoPreparado,
                    estadoEmocional
                })
            });

            if (!resposta.ok) {

                let mensagemErro =
                    "Não foi possível gerar a voz neural.";

                try {

                    const dadosErro = await resposta.json();

                    if (dadosErro && dadosErro.erro) {
                        mensagemErro = dadosErro.erro;
                    }

                } catch {
                    logger.warn(
                        "Resposta de erro da voz não estava em JSON."
                    );
                }

                throw new Error(mensagemErro);
            }

            const tipoAudio = "audio/mpeg";
            const suportaStreaming =
                mediaSourceConstructor &&
                mediaSourceConstructor.isTypeSupported(tipoAudio) &&
                resposta.body;

            if (suportaStreaming) {
                await reproduzirStreaming(resposta, tipoAudio);
            } else {
                await reproduzirBlob(resposta);
            }

        } catch (erro) {

            logger.error("Erro na voz neural da LIA:", erro);
            falarComVozLocal(textoPreparado, windowRef);

        } finally {

            processamentoEmAndamento = false;
        }
    }

    async function reproduzirStreaming(resposta, tipoAudio) {

        const mediaSource = new mediaSourceConstructor();
        urlAudioAtual = urlApi.createObjectURL(mediaSource);

        const player = audioConstructor();
        audioAtual = player;
        player.src = urlAudioAtual;
        player.volume = 1;

        await new Promise((resolve, reject) => {

            mediaSource.addEventListener("sourceopen", resolve, { once: true });
            mediaSource.addEventListener("error", reject, { once: true });
        });

        const sourceBuffer = mediaSource.addSourceBuffer(tipoAudio);
        const leitor = resposta.body.getReader();
        let iniciou = false;

        while (true) {

            const { done, value } = await leitor.read();

            if (done) {
                break;
            }

            await new Promise((resolve, reject) => {

                sourceBuffer.addEventListener("updateend", resolve, {
                    once: true
                });
                sourceBuffer.addEventListener("error", reject, {
                    once: true
                });
                sourceBuffer.appendBuffer(value);
            });

            if (!iniciou) {
                iniciou = true;
                player.play().catch(erro => logger.warn(
                    "Reprodução aguardando:",
                    erro
                ));
            }
        }

        if (mediaSource.readyState === "open" && !sourceBuffer.updating) {
            mediaSource.endOfStream();
        }

        player.onended = liberarAudioAtual;
    }

    async function reproduzirBlob(resposta) {

        const audioBlob = await resposta.blob();

        if (!audioBlob || audioBlob.size === 0) {
            throw new Error("O servidor retornou um áudio vazio.");
        }

        urlAudioAtual = urlApi.createObjectURL(audioBlob);
        const player = audioConstructor(urlAudioAtual);
        audioAtual = player;
        player.volume = 1;
        player.onended = liberarAudioAtual;

        await player.play();
    }

    function liberarAudioAtual() {

        if (urlAudioAtual) {
            urlApi.revokeObjectURL(urlAudioAtual);
            urlAudioAtual = null;
        }

        audioAtual = null;
    }

    return {
        falar,
        parar,
        atualizarBotao,
        definirSupressao(suprimir) {
            vozSuprimida = suprimir;
        },
        alternarAtivacao() {

            vozAtiva = !vozAtiva;
            vozSuprimida = !vozAtiva;
            atualizarBotao();

            if (!vozAtiva) {
                parar();
            }

            return vozAtiva;
        },
        desativar() {

            vozAtiva = false;
            vozSuprimida = true;
            parar();
            atualizarBotao();
        }
    };
}
