export function extrairMensagemErroApi(
    dados,
    fallback = "Ocorreu um erro inesperado."
) {

    if (
        dados &&
        typeof dados === "object"
    ) {

        if (
            typeof dados.erro === "string" &&
            dados.erro.trim()
        ) {
            return dados.erro.trim();
        }

        if (
            typeof dados.mensagem === "string" &&
            dados.mensagem.trim()
        ) {
            return dados.mensagem.trim();
        }
    }

    return fallback;
}

export function mostrarMensagemAuth(
    elemento,
    texto,
    tipo = "error"
) {

    if (!elemento) {
        return;
    }

    elemento.textContent =
        texto || "";

    elemento.classList.remove(
        "error",
        "success"
    );

    if (texto) {

        elemento.classList.add(
            tipo
        );
    }
}
