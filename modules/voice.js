export function atualizarEstadoVozLia({
    btnToggleVoz,
    vozAtiva
}) {

    if (!btnToggleVoz) {
        return;
    }

    const icon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");

    const speaker = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
    );
    speaker.setAttribute(
        "d",
        "M11 5 6 9H3v6h3l5 4V5Z"
    );
    icon.append(speaker);

    const stateMark = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
    );
    stateMark.setAttribute(
        "d",
        vozAtiva ?
            "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" :
            "m16 9 5 6m0-6-5 6"
    );
    icon.append(stateMark);
    btnToggleVoz.replaceChildren(icon);

    btnToggleVoz.title =
        vozAtiva ?
            "Desligar voz da LIA" :
            "Ligar voz da LIA";

    btnToggleVoz.setAttribute(
        "aria-label",
        vozAtiva ?
            "Desligar voz da LIA" :
            "Ligar voz da LIA"
    );

    btnToggleVoz.setAttribute(
        "aria-pressed",
        String(vozAtiva)
    );
}

export function pararVozLia({
    audioLiaAtual,
    urlAudioLiaAtual,
    windowRef = window
}) {

    if (audioLiaAtual) {

        try {

            audioLiaAtual.pause();
            audioLiaAtual.currentTime = 0;

        } catch (erro) {

            console.warn(
                "Não foi possível parar o áudio atual da LIA.",
                erro
            );
        }
    }

    if (urlAudioLiaAtual) {

        URL.revokeObjectURL(
            urlAudioLiaAtual
        );
    }

    if (
        "speechSynthesis" in windowRef
    ) {

        windowRef.speechSynthesis.cancel();
    }

    return {
        audioLiaAtual: null,
        urlAudioLiaAtual: null
    };
}

export function falarComVozLocal(
    texto,
    windowRef = globalThis.window
) {

    if (!texto) {
        return;
    }

    if (
        !windowRef ||
        !("speechSynthesis" in windowRef)
    ) {
        return;
    }

    const Utterance =
        windowRef.SpeechSynthesisUtterance ||
        globalThis.SpeechSynthesisUtterance;

    if (
        typeof Utterance === "undefined"
    ) {
        return;
    }

    windowRef.speechSynthesis.cancel();

    const fala =
        new Utterance(
            texto
        );

    fala.lang = "pt-BR";
    fala.rate = 1;
    fala.pitch = 1;
    fala.volume = 1;

    const vozesDisponiveis =
        windowRef.speechSynthesis.getVoices?.() || [];
    fala.voice =
        vozesDisponiveis.find(voz =>
            voz.lang?.toLowerCase() === "pt-br"
        ) ||
        vozesDisponiveis.find(voz =>
            voz.lang?.toLowerCase().startsWith("pt-")
        ) ||
        null;

    windowRef.speechSynthesis.speak(
        fala
    );
}
