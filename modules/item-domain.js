function normalizarTexto(texto) {

    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function pontuarSemelhancaItem(
    titulo,
    busca
) {

    if (titulo == null || busca == null) {
        return 0;
    }

    const tituloNormal =
        normalizarTexto(titulo);
    const buscaNormal =
        normalizarTexto(busca);

    if (!tituloNormal || !buscaNormal) {
        return 0;
    }

    if (tituloNormal === buscaNormal) {
        return 100;
    }

    if (
        tituloNormal.includes(buscaNormal) ||
        buscaNormal.includes(tituloNormal)
    ) {
        return 80;
    }

    const palavrasTitulo =
        tituloNormal.split(/\s+/);
    const palavrasBusca =
        buscaNormal.split(/\s+/);

    return palavrasBusca.reduce(
        (pontos, palavra) => (
            palavra.length > 2 &&
            palavrasTitulo.includes(palavra)
        ) ? pontos + 10 : pontos,
        0
    );
}

export function buscarItemSemelhante(
    itens,
    busca
) {

    if (!busca || !Array.isArray(itens)) {
        return null;
    }

    const buscaNormalizada =
        String(busca).trim();

    if (!buscaNormalizada) {
        return null;
    }

    let melhorItem = null;
    let maiorPontuacao = 0;

    for (const item of itens) {

        if (!item || typeof item !== "object") {
            continue;
        }

        const pontos =
            pontuarSemelhancaItem(
                item.titulo,
                buscaNormalizada
            );

        if (pontos > maiorPontuacao) {
            maiorPontuacao = pontos;
            melhorItem = item;
        }
    }

    return maiorPontuacao >= 10 ?
        melhorItem :
        null;
}

export function encontrarItemDuplicado(
    itens,
    candidato
) {

    if (!Array.isArray(itens) || !candidato || typeof candidato !== "object") {
        return null;
    }

    const titulo =
        String(candidato.titulo || "")
            .trim()
            .toLowerCase();

    return itens.find(item => (
        item &&
        typeof item === "object" &&
        String(item.titulo || "")
            .trim()
            .toLowerCase() === titulo &&
        item.tipo === candidato.tipo &&
        (item.data || null) === (candidato.data || null) &&
        (item.horario || null) === (candidato.horario || null)
    )) || null;
}
