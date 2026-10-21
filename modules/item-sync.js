import { extrairMensagemErroApi } from "./ux.js";

export function createItemSync({
    getUserId,
    getItems,
    isReady,
    setStatus,
    onConflict,
    storage,
    logger = console,
    fetcher = fetch
}) {

    let fila = Promise.resolve();
    let revisionAtual = null;
    let conflitoDetectado = false;
    let itensBase = [];
    let conflitoPendente = null;

    function chaveConflito(userId) {
        return `liaConflitoSincronizacao_${userId}`;
    }

    function clonarItens(items) {
        return JSON.parse(JSON.stringify(items));
    }

    function mesmasListas(left, right) {
        const canonical = items => items
            .map(item => ({
                id: String(item.id),
                titulo: item.titulo,
                tipo: item.tipo,
                data: item.data ?? null,
                horario: item.horario ?? null,
                concluido: item.concluido === true
            }))
            .sort((a, b) => a.id.localeCompare(b.id));

        return JSON.stringify(canonical(left)) ===
            JSON.stringify(canonical(right));
    }

    function salvarConflito(userId, conflito) {
        conflitoPendente = conflito;
        conflitoDetectado = true;
        storage.setItem(
            chaveConflito(userId),
            JSON.stringify(conflito)
        );
    }

    async function carregarVersaoServidor(userId) {
        const response = await fetcher(
            "/api/itens",
            {
                method: "GET",
                credentials: "same-origin"
            }
        );
        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error("Não foi possível carregar a versão do servidor.");
        }

        if (!response.ok) {
            throw new Error(
                extrairMensagemErroApi(
                    data,
                    "Não foi possível carregar a versão do servidor."
                )
            );
        }

        if (
            !Array.isArray(data.itens) ||
            !Number.isSafeInteger(data.revision) ||
            data.revision < 0
        ) {
            throw new Error(
                "O servidor retornou dados ou versão inválidos."
            );
        }

        return {
            itens: data.itens,
            revision: data.revision
        };
    }

    function lerConflitoSalvo(userId) {
        const serialized = storage.getItem(chaveConflito(userId));

        if (!serialized) {
            return null;
        }

        let conflict;

        try {
            conflict = JSON.parse(serialized);
        } catch {
            throw new Error(
                "O rascunho de sincronização está corrompido e foi preservado no navegador."
            );
        }

        if (
            !conflict ||
            !Array.isArray(conflict.base) ||
            !Array.isArray(conflict.local)
        ) {
            throw new Error(
                "O rascunho de sincronização tem um formato inválido e foi preservado no navegador."
            );
        }

        return conflict;
    }

    async function requestItems({
        method,
        items,
        revision,
        fallback
    }) {

        const response = await fetcher(
            "/api/itens",
            {
                method,
                credentials: "same-origin",
                ...(items ? {
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        itens: items,
                        revision
                    })
                } : {})
            }
        );

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(fallback);
        }

        if (!response.ok) {
            const erro = new Error(
                extrairMensagemErroApi(data, fallback)
            );
            erro.status = response.status;
            erro.conflict = data?.conflito === true;
            throw erro;
        }

        if (
            !Number.isSafeInteger(data.revision) ||
            data.revision < 0
        ) {
            throw new Error(
                "O servidor retornou uma versão inválida dos dados."
            );
        }

        return data;
    }

    async function load(userId, { migrateLegacy = true } = {}) {

        if (!userId) {
            throw new Error(
                "Não foi possível identificar a conta para carregar os dados."
            );
        }

        const salvo = lerConflitoSalvo(userId);
        let data;

        try {
            data = await carregarVersaoServidor(userId);
        } catch (erro) {
            if (!salvo) {
                throw erro;
            }

            conflitoPendente = {
                ...salvo,
                server: null,
                serverRevision: null
            };
            itensBase = clonarItens(salvo.base);
            conflitoDetectado = true;
            return clonarItens(salvo.local);
        }

        if (salvo) {
            if (mesmasListas(salvo.local, data.itens)) {
                try {
                    storage.removeItem(chaveConflito(userId));
                } catch (erro) {
                    logger.error(
                        "Não foi possível remover um rascunho de conflito já sincronizado:",
                        erro
                    );
                }
                revisionAtual = data.revision;
                itensBase = clonarItens(data.itens);
                conflitoPendente = null;
                conflitoDetectado = false;
                return data.itens;
            }

            conflitoPendente = {
                ...salvo,
                server: data.itens,
                serverRevision: data.revision
            };
            storage.setItem(
                chaveConflito(userId),
                JSON.stringify(conflitoPendente)
            );
            revisionAtual = data.revision;
            itensBase = clonarItens(salvo.base);
            conflitoDetectado = true;
            return clonarItens(salvo.local);
        }

        const userKey =
            `liaItens_${userId}`;
        const migrationKey =
            `liaMigracaoServidor_${userId}`;
        let items =
            data.itens;
        let revision =
            data.revision;

        if (
            migrateLegacy &&
            items.length === 0 &&
            storage.getItem(migrationKey) !== "concluida"
        ) {

            const legacyKey =
                storage.getItem(userKey) ?
                    userKey :
                    "liaItens";
            const legacyData =
                storage.getItem(legacyKey);

            if (legacyData) {

                let legacyItems;

                try {
                    legacyItems = JSON.parse(legacyData);
                } catch {
                    throw new Error(
                        "Os dados antigos deste navegador estão corrompidos e não foram migrados."
                    );
                }

                if (!Array.isArray(legacyItems)) {
                    throw new Error(
                        "O formato dos dados antigos não é válido; eles não foram migrados."
                    );
                }

                if (legacyItems.length > 0) {

                    const migration =
                        await requestItems({
                            method: "PUT",
                            items: legacyItems,
                            revision,
                            fallback: "Não foi possível migrar os dados deste navegador."
                        });

                    if (!Array.isArray(migration.itens)) {
                        throw new Error(
                            "O servidor retornou dados inválidos durante a migração."
                        );
                    }

                    items = migration.itens;
                    revision = migration.revision;
                }
            }

            storage.setItem(
                migrationKey,
                "concluida"
            );
        }

        revisionAtual = revision;
        itensBase = clonarItens(items);
        conflitoPendente = null;
        conflitoDetectado = false;
        return items;
    }

    function save() {

        const userId =
            getUserId();

        if (!userId || !isReady()) {
            setStatus(
                "Os dados ainda não estão carregados; a alteração não foi sincronizada.",
                true,
                true
            );
            return fila;
        }

        if (conflitoDetectado) {
            return fila;
        }

        const items = getItems();
        const snapshot =
            Array.isArray(items) ?
                JSON.parse(JSON.stringify(items)) :
                [];

        setStatus("Salvando alterações...");

        fila = fila
            .then(async () => {

                if (getUserId() !== userId) {
                    return;
                }

                if (conflitoDetectado) {
                    return;
                }

                const result = await requestItems({
                    method: "PUT",
                    items: snapshot,
                    revision: revisionAtual,
                    fallback: "Não foi possível salvar seus dados."
                });

                if (getUserId() === userId) {
                    revisionAtual = result.revision;
                    itensBase = clonarItens(result.itens);
                    setStatus(
                        "Alterações salvas no servidor."
                    );
                }
            })
            .catch(async erro => {

                logger.error(
                    "Erro ao sincronizar itens:",
                    erro
                );

                if (getUserId() === userId) {
                    if (erro.conflict) {
                        const local = Array.isArray(getItems()) ?
                            clonarItens(getItems()) :
                            snapshot;
                        const conflict = {
                            base: clonarItens(itensBase),
                            local,
                            server: null,
                            serverRevision: null
                        };

                        try {
                            const latest = await carregarVersaoServidor(userId);
                            conflict.server = latest.itens;
                            conflict.serverRevision = latest.revision;
                        } catch (refreshError) {
                            logger.error(
                                "Erro ao carregar dados para revisar o conflito:",
                                refreshError
                            );
                        }

                        try {
                            salvarConflito(userId, conflict);
                        } catch (storageError) {
                            logger.error(
                                "Erro ao preservar o rascunho do conflito:",
                                storageError
                            );
                            onConflict?.(conflict);
                            setStatus(
                                "Há um conflito e não foi possível preservar uma cópia no navegador. Não recarregue nem feche esta página.",
                                true,
                                false
                            );
                            onConflict?.(conflict);
                            return;
                        }

                        setStatus(
                            conflict.server ?
                                "Suas alterações foram preservadas. Revise as versões antes de salvar." :
                                "Suas alterações foram preservadas. Não foi possível carregar a versão do servidor; tente novamente para revisar.",
                            true,
                            true,
                            conflict.server ?
                                "Revisar alterações" :
                                "Carregar versão do servidor"
                        );
                        onConflict?.(conflict);
                    } else {
                        setStatus(
                            `Não foi possível salvar: ${erro.message}`,
                            true,
                            true
                        );
                    }
                }
            });

        return fila;
    }

    return {
        load,
        save,
        getConflict() {
            return conflitoPendente ?
                clonarItens(conflitoPendente) :
                null;
        },
        async refreshConflict() {

            const userId = getUserId();

            if (!userId || !conflitoPendente) {
                throw new Error("Não há conflito para atualizar.");
            }

            const latest = await carregarVersaoServidor(userId);
            conflitoPendente = {
                ...conflitoPendente,
                server: latest.itens,
                serverRevision: latest.revision
            };
            revisionAtual = latest.revision;
            salvarConflito(userId, conflitoPendente);
            return this.getConflict();
        },
        async resolveConflict(items) {

            const userId = getUserId();

            if (
                !userId ||
                !conflitoPendente ||
                !Array.isArray(conflitoPendente.server) ||
                !Number.isSafeInteger(conflitoPendente.serverRevision)
            ) {
                throw new Error(
                    "Carregue a versão do servidor antes de revisar as alterações."
                );
            }

            try {
                const result = await requestItems({
                    method: "PUT",
                    items,
                    revision: conflitoPendente.serverRevision,
                    fallback: "Não foi possível salvar a combinação."
                });

                revisionAtual = result.revision;
                itensBase = clonarItens(result.itens);
                conflitoPendente = null;
                conflitoDetectado = false;
                try {
                    storage.removeItem(chaveConflito(userId));
                } catch (erro) {
                    logger.error(
                        "Não foi possível remover o rascunho de conflito resolvido:",
                        erro
                    );
                }
                return {
                    itens: result.itens,
                    conflito: null
                };
            } catch (erro) {

                if (!erro.conflict) {
                    throw erro;
                }

                const previousServer = clonarItens(
                    conflitoPendente.server
                );
                let latest;

                try {
                    latest = await carregarVersaoServidor(userId);
                } catch (refreshError) {
                    salvarConflito(userId, {
                        base: previousServer,
                        local: clonarItens(items),
                        server: null,
                        serverRevision: null
                    });
                    throw new Error(
                        "Outra sessão alterou os dados novamente. Suas escolhas foram preservadas; atualize a versão do servidor para continuar."
                    );
                }

                salvarConflito(userId, {
                    base: previousServer,
                    local: clonarItens(items),
                    server: latest.itens,
                    serverRevision: latest.revision
                });
                revisionAtual = latest.revision;
                return {
                    itens: clonarItens(items),
                    conflito: this.getConflict()
                };
            }
        },
        hasConflict() {
            return conflitoDetectado;
        },
        waitForPendingSaves() {
            return fila;
        }
    };
}
