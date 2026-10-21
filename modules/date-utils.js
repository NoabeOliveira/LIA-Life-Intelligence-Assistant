export function formatarDataISO(data) {

    if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
        return "";
    }

    const ano =
        data.getFullYear();
    const mes =
        String(data.getMonth() + 1)
            .padStart(2, "0");
    const dia =
        String(data.getDate())
            .padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

export function criarDataLocal(dataISO) {

    if (
        typeof dataISO !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dataISO)
    ) {
        return null;
    }

    const [ano, mes, dia] =
        dataISO.split("-").map(Number);
    const data = new Date(0);
    data.setFullYear(ano, mes - 1, dia);
    data.setHours(0, 0, 0, 0);

    if (
        data.getFullYear() !== ano ||
        data.getMonth() !== mes - 1 ||
        data.getDate() !== dia
    ) {
        return null;
    }

    return data;
}

export function formatarDataBrasileira(dataISO) {

    const data =
        criarDataLocal(dataISO);

    if (!data) {
        return "";
    }

    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = String(data.getFullYear()).padStart(4, "0");

    return `${dia}/${mes}/${ano}`;
}

export function dataDeHoje(agora = new Date()) {

    if (!(agora instanceof Date) || Number.isNaN(agora.getTime())) {
        return "";
    }

    return formatarDataISO(agora);
}

export function dataDeAmanha(agora = new Date()) {

    if (!(agora instanceof Date) || Number.isNaN(agora.getTime())) {
        return "";
    }

    const amanha =
        new Date(agora);

    amanha.setDate(
        amanha.getDate() + 1
    );

    return formatarDataISO(amanha);
}
