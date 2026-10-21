import assert from "node:assert/strict";
import test from "node:test";

import { createItemSync } from "../modules/item-sync.js";

function createStorage(initial = {}) {

    const values = new Map(
        Object.entries(initial)
    );

    return {
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
        values
    };
}

function createResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return body;
        }
    };
}

test("migrates legacy browser data only after server accepts it", async () => {

    const storage = createStorage({
        liaItens_user1: JSON.stringify([{
            id: "legacy",
            titulo: "Migrar",
            tipo: "tarefa",
            data: null,
            horario: null,
            concluido: false
        }])
    });
    const requests = [];
    const sync = createItemSync({
        getUserId: () => "user1",
        getItems: () => [],
        isReady: () => true,
        setStatus() {},
        storage,
        async fetcher(url, options) {

            requests.push(options);

            if (options.method === "GET") {
                return createResponse(200, { itens: [], revision: 0 });
            }

            return createResponse(
                200,
                {
                    itens: JSON.parse(options.body).itens,
                    revision: 1
                }
            );
        }
    });

    const loaded =
        await sync.load("user1");

    assert.equal(loaded[0].titulo, "Migrar");
    assert.equal(
        requests.filter(request => request.method === "PUT").length,
        1
    );
    assert.equal(
        storage.getItem("liaMigracaoServidor_user1"),
        "concluida"
    );
});

test("does not mark legacy migration complete when the server rejects it", async () => {

    const storage = createStorage({
        liaItens_user1: JSON.stringify([{
            id: "legacy",
            titulo: "Migrar",
            tipo: "tarefa"
        }])
    });
    const sync = createItemSync({
        getUserId: () => "user1",
        getItems: () => [],
        isReady: () => true,
        setStatus() {},
        storage,
        async fetcher(_url, options) {

            return options.method === "GET" ?
                createResponse(200, { itens: [], revision: 0 }) :
                createResponse(400, {
                    erro: "Dados inválidos."
                });
        }
    });

    await assert.rejects(
        sync.load("user1"),
        /Dados inválidos/
    );

    assert.equal(
        storage.getItem("liaMigracaoServidor_user1"),
        null
    );
});

test("reloading after a conflict does not re-import stale browser data", async () => {

    const storage = createStorage({
        liaItens_user1: JSON.stringify([{
            id: "old",
            titulo: "Dados locais antigos",
            tipo: "tarefa"
        }])
    });
    const requests = [];
    const sync = createItemSync({
        getUserId: () => "user1",
        getItems: () => [],
        isReady: () => true,
        setStatus() {},
        storage,
        async fetcher(_url, options) {
            requests.push(options.method);
            return createResponse(200, {
                itens: [],
                revision: 3
            });
        }
    });

    const loaded = await sync.load("user1", {
        migrateLegacy: false
    });

    assert.deepEqual(loaded, []);
    assert.deepEqual(requests, ["GET"]);
});

test("preserves local work across reload and saves the reviewed merge", async () => {

    const storage = createStorage();
    const original = [{
        id: "1",
        titulo: "Original",
        tipo: "tarefa",
        concluido: false
    }];
    const localItems = [
        {
            id: "1",
            titulo: "Atualizada localmente",
            tipo: "tarefa",
            concluido: false
        },
        {
            id: "local",
            titulo: "Nova tarefa local",
            tipo: "tarefa",
            concluido: false
        }
    ];
    const serverItems = [
        {
            id: "1",
            titulo: "Original",
            tipo: "tarefa",
            concluido: false
        },
        {
            id: "server",
            titulo: "Nova tarefa no servidor",
            tipo: "tarefa",
            concluido: false
        }
    ];
    let phase = "first";
    let currentItems = original;
    const statuses = [];

    const firstSync = createItemSync({
        getUserId: () => "user1",
        getItems: () => currentItems,
        isReady: () => true,
        setStatus: (...args) => statuses.push(args),
        onConflict() {},
        logger: { error() {} },
        storage,
        async fetcher(_url, options) {

            if (options.method === "GET") {
                return createResponse(
                    200,
                    { itens: original, revision: 1 }
                );
            }

            return createResponse(409, {
                conflito: true,
                erro: "Dados alterados em outra sessão."
            });
        }
    });

    await firstSync.load("user1");
    currentItems = localItems;
    firstSync.save();
    await firstSync.waitForPendingSaves();

    assert.equal(firstSync.hasConflict(), true);
    assert.deepEqual(firstSync.getConflict().local, localItems);
    assert.equal(
        storage.getItem("liaConflitoSincronizacao_user1") !== null,
        true
    );

    phase = "reloaded";
    const reloadedSync = createItemSync({
        getUserId: () => "user1",
        getItems: () => currentItems,
        isReady: () => true,
        setStatus: (...args) => statuses.push(args),
        logger: { error() {} },
        storage,
        async fetcher(_url, options) {

            if (options.method === "GET") {
                return createResponse(
                    200,
                    { itens: serverItems, revision: 2 }
                );
            }

            assert.equal(phase, "reloaded");
            const payload = JSON.parse(options.body);
            assert.equal(payload.revision, 2);
            assert.deepEqual(
                payload.itens.map(item => item.id),
                ["1", "server", "local"]
            );
            return createResponse(200, {
                itens: payload.itens,
                revision: 3
            });
        }
    });

    currentItems = await reloadedSync.load("user1");
    assert.deepEqual(currentItems, localItems);
    assert.equal(reloadedSync.hasConflict(), true);

    const merged = [
        localItems[0],
        serverItems[1],
        localItems[1]
    ];
    const result = await reloadedSync.resolveConflict(merged);

    assert.deepEqual(result.itens, merged);
    assert.equal(result.conflito, null);
    assert.equal(reloadedSync.hasConflict(), false);
    assert.equal(
        storage.getItem("liaConflitoSincronizacao_user1"),
        null
    );
});

test("restores the local conflict draft when the server is temporarily unavailable", async () => {

    const local = [{
        id: "1",
        titulo: "Rascunho local",
        tipo: "tarefa"
    }];
    const storage = createStorage({
        liaConflitoSincronizacao_user1: JSON.stringify({
            base: [],
            local,
            server: [{
                id: "server",
                titulo: "Servidor anterior",
                tipo: "tarefa"
            }],
            serverRevision: 2
        })
    });
    const sync = createItemSync({
        getUserId: () => "user1",
        getItems: () => local,
        isReady: () => true,
        setStatus() {},
        logger: { error() {} },
        storage,
        async fetcher() {
            throw new Error("offline");
        }
    });

    assert.deepEqual(await sync.load("user1"), local);
    assert.equal(sync.hasConflict(), true);
    assert.equal(sync.getConflict().server, null);
    assert.equal(
        storage.getItem("liaConflitoSincronizacao_user1") !== null,
        true
    );
});

test("serializes saves and reports failures without losing queued writes", async () => {

    let items = [{
        id: "1",
        titulo: "Primeira versão",
        tipo: "tarefa"
    }];
    let userId = "user1";
    const statuses = [];
    const sent = [];
    let serverRevision = 0;
    let ready = true;
    const sync = createItemSync({
        getUserId: () => userId,
        getItems: () => items,
        isReady: () => ready,
        setStatus: (...args) => statuses.push(args),
        storage: createStorage(),
        async fetcher(_url, options) {

            if (options.method === "GET") {
                return createResponse(200, {
                    itens: [],
                    revision: serverRevision
                });
            }

            const payload =
                JSON.parse(options.body);

            sent.push(payload.itens);
            assert.equal(payload.revision, serverRevision);
            serverRevision += 1;
            return createResponse(200, {
                itens: payload.itens,
                revision: serverRevision
            });
        }
    });

    await sync.load("user1");
    sync.save();
    items = [{
        id: "1",
        titulo: "Versão atualizada",
        tipo: "tarefa"
    }];
    sync.save();
    await sync.waitForPendingSaves();

    assert.deepEqual(
        sent.map(batch => batch[0].titulo),
        ["Primeira versão", "Versão atualizada"]
    );
    assert.equal(serverRevision, 2);

    ready = false;
    sync.save();

    assert.equal(
        statuses.at(-1)[1],
        true
    );

    ready = true;
    userId = null;
    sync.save();
    await sync.waitForPendingSaves();

    assert.deepEqual(
        sent.map(batch => batch[0].titulo),
        ["Primeira versão", "Versão atualizada"]
    );
});

test("stops queued writes after a revision conflict and exposes reload state", async () => {

    const statuses = [];
    let sentRequests = 0;
    const sync = createItemSync({
        getUserId: () => "user1",
        getItems: () => [{
            id: "1",
            titulo: "Local",
            tipo: "tarefa"
        }],
        isReady: () => true,
        setStatus: (...args) => statuses.push(args),
        logger: {
            error() {}
        },
        storage: createStorage(),
        async fetcher(_url, options) {

            if (options.method === "GET") {
                return createResponse(200, {
                    itens: [],
                    revision: 1
                });
            }

            sentRequests += 1;
            return createResponse(409, {
                conflito: true,
                erro: "Seus dados foram alterados em outra sessão."
            });
        }
    });

    sync.save();
    sync.save();
    await sync.waitForPendingSaves();

    assert.equal(sentRequests, 1);
    assert.equal(sync.hasConflict(), true);
    assert.equal(statuses.at(-1)[2], true);
    assert.equal(statuses.at(-1)[3], "Revisar alterações");
});
