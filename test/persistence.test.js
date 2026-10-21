import assert from "node:assert/strict";
import { once } from "node:events";
import {
    mkdtempSync,
    rmSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    createItemStore,
    validarItens
} from "../modules/item-store.js";
import { createObjectiveStore } from "../modules/objective-store.js";
import { createSqliteSessionStore } from "../modules/sqlite-session-store.js";
import { createSqliteUsageLimiter } from "../modules/sqlite-usage-limiter.js";

const testDirectory =
    mkdtempSync(path.join(os.tmpdir(), "lia-api-test-"));

process.env.OPENAI_API_KEY ||= "test-key";
process.env.SESSION_SECRET ||= "test-session-secret";
process.env.LIA_DATABASE_PATH =
    path.join(testDirectory, "api.sqlite");
process.env.LIA_USERS_FILE =
    path.join(testDirectory, "users.json");

const {
    app,
    closeItemStore,
    closeObjectiveStore,
    closeSessionStore,
    closeUsageLimiter
} = await import("../server.js");

test("SQLite persists item lists and isolates users", t => {

    const directory =
        mkdtempSync(path.join(os.tmpdir(), "lia-store-test-"));
    const databasePath =
        path.join(directory, "items.sqlite");
    const firstStore =
        createItemStore(databasePath);
    let activeStore = firstStore;

    t.after(() => {
        activeStore?.close();
        rmSync(directory, {
            recursive: true,
            force: true
        });
    });

    const firstUserItems = [
        {
            id: 123,
            titulo: "Revisar projeto",
            tipo: "tarefa",
            data: "2026-10-20",
            horario: "09:30",
            concluido: false
        }
    ];

    firstStore.replace("user-1", firstUserItems);
    firstStore.replace("user-2", []);

    assert.deepEqual(
        firstStore.list("user-1"),
        [{
            id: "123",
            titulo: "Revisar projeto",
            tipo: "tarefa",
            data: "2026-10-20",
            horario: "09:30",
            concluido: false
        }]
    );
    assert.deepEqual(firstStore.list("user-2"), []);

    assert.throws(
        () => firstStore.replace("user-1", [{
            ...firstUserItems[0],
            tipo: "inválido"
        }]),
        /tipo/
    );
    assert.throws(
        () => validarItens([{
            ...firstUserItems[0],
            data: "2026-02-30"
        }]),
        /data/
    );
    assert.throws(
        () => validarItens([{
            ...firstUserItems[0],
            horario: "24:00"
        }]),
        /horário/
    );

    assert.equal(
        firstStore.list("user-1")[0].titulo,
        "Revisar projeto",
        "uma gravação inválida não deve apagar itens já salvos"
    );

    firstStore.close();
    activeStore = null;
    const reopenedStore =
        createItemStore(databasePath);
    activeStore = reopenedStore;

    try {
        assert.equal(
            reopenedStore.list("user-1").length,
            1,
            "os itens devem permanecer após reabrir o banco"
        );
    } finally {
        reopenedStore.close();
        activeStore = null;
    }
});

test("SQLite stores objectives, calculates progress and isolates users", t => {

    const directory =
        mkdtempSync(path.join(os.tmpdir(), "lia-objective-test-"));
    const databasePath =
        path.join(directory, "objectives.sqlite");
    let store = createObjectiveStore(databasePath);

    t.after(() => {
        store?.close();
        rmSync(directory, {
            recursive: true,
            force: true
        });
    });

    const objective = store.create("user-1", {
        titulo: "Aprender italiano",
        dataLimite: "2027-12-31",
        etapas: ["Estudar vocabulário", "Praticar conversação"]
    });

    assert.equal(objective.progresso, 0);
    assert.equal(objective.etapas.length, 2);
    assert.deepEqual(store.list("user-2"), []);
    assert.throws(
        () => store.create("user-1", {
            titulo: "Sem etapas",
            etapas: []
        }),
        /etapas/
    );
    assert.throws(
        () => store.create("user-1", {
            titulo: "Data inválida",
            dataLimite: "2027-02-30",
            etapas: ["Etapa"]
        }),
        /data limite/
    );

    const updated = store.setMilestoneCompleted(
        "user-1",
        objective.id,
        objective.etapas[0].id,
        true
    );
    assert.equal(updated.progresso, 50);

    assert.equal(
        store.setMilestoneCompleted(
            "user-2",
            objective.id,
            objective.etapas[0].id,
            false
        ),
        null
    );
    const afterDelete = store.deleteMilestone(
        "user-1",
        objective.id,
        objective.etapas[1].id
    );
    assert.equal(afterDelete.etapas.length, 1);
    assert.throws(
        () => store.deleteMilestone(
            "user-1",
            objective.id,
            objective.etapas[0].id
        ),
        /pelo menos uma etapa/
    );

    const added = store.addMilestone(
        "user-1",
        objective.id,
        "Revisar conteúdo"
    );
    assert.equal(added.etapas.length, 2);
    assert.equal(added.progresso, 50);

    assert.equal(store.delete("user-2", objective.id), false);
    assert.equal(store.delete("user-1", objective.id), true);
    assert.deepEqual(store.list("user-1"), []);

    const objectiveAtMilestoneLimit = store.create("user-1", {
        titulo: "Objetivo com muitas etapas",
        etapas: Array.from(
            { length: 30 },
            (_, index) => `Etapa ${index + 1}`
        )
    });
    assert.throws(
        () => store.addMilestone(
            "user-1",
            objectiveAtMilestoneLimit.id,
            "Etapa excedente"
        ),
        /limite é de 30 etapas/
    );

    for (let index = 1; index < 100; index += 1) {
        store.create("user-1", {
            titulo: `Objetivo ${index + 1}`,
            etapas: ["Etapa"]
        });
    }
    assert.equal(store.list("user-1").length, 100);
    assert.throws(
        () => store.create("user-1", {
            titulo: "Objetivo excedente",
            etapas: ["Etapa"]
        }),
        /limite é de 100 objetivos/
    );

    store.close();
    store = null;
});

test("SQLite sessions survive reopening the session store", t => {

    const directory =
        mkdtempSync(path.join(os.tmpdir(), "lia-session-test-"));
    const databasePath =
        path.join(directory, "sessions.sqlite");
    let store =
        createSqliteSessionStore(databasePath);

    t.after(() => {

        store?.close();

        rmSync(directory, {
            recursive: true,
            force: true
        });
    });

    const sessionData = {
        cookie: {
            expires: new Date(
                Date.now() + 60_000
            ).toISOString()
        },
        usuario: {
            id: "user-session-test",
            email: "session@example.test"
        }
    };

    store.set(
        "session-test",
        sessionData,
        erro => assert.ifError(erro)
    );

    store.close();
    store = createSqliteSessionStore(databasePath);

    store.get(
        "session-test",
        (erro, dados) => {

            assert.ifError(erro);
            assert.deepEqual(dados, sessionData);
        }
    );

    store.close();
    store = createSqliteSessionStore(databasePath);

    store.set(
        "expired-session",
        {
            cookie: {
                expires: new Date(
                    Date.now() - 60_000
                ).toISOString()
            }
        },
        erro => assert.ifError(erro)
    );

    store.get(
        "expired-session",
        (erro, dados) => {

            assert.ifError(erro);
            assert.equal(dados, null);
        }
    );
});

test("SQLite item revisions reject stale writes without replacing current data", t => {

    const directory =
        mkdtempSync(path.join(os.tmpdir(), "lia-revision-test-"));
    const databasePath =
        path.join(directory, "items.sqlite");
    const firstStore = createItemStore(databasePath);
    const secondStore = createItemStore(databasePath);

    t.after(() => {
        firstStore.close();
        secondStore.close();
        rmSync(directory, {
            recursive: true,
            force: true
        });
    });

    const original = [{
        id: "1",
        titulo: "Original",
        tipo: "tarefa"
    }];
    const updated = [{
        id: "1",
        titulo: "Atualizada",
        tipo: "tarefa"
    }];

    assert.equal(firstStore.getRevision("user-1"), 0);
    firstStore.replace("user-1", original, 0);
    assert.equal(secondStore.getRevision("user-1"), 1);

    assert.throws(
        () => secondStore.replace("user-1", [{
            id: "2",
            titulo: "Escrita obsoleta",
            tipo: "tarefa"
        }], 0),
        /alterados em outra sessão/
    );

    secondStore.replace("user-1", updated, 1);
    assert.equal(firstStore.getRevision("user-1"), 2);
    assert.equal(firstStore.list("user-1")[0].titulo, "Atualizada");
});

test("SQLite usage limits are atomic, persistent and isolated by user and route", t => {

    const directory =
        mkdtempSync(path.join(os.tmpdir(), "lia-usage-test-"));
    const databasePath =
        path.join(directory, "usage.sqlite");
    let store = createSqliteUsageLimiter(databasePath);

    t.after(() => {
        store?.close();
        rmSync(directory, {
            recursive: true,
            force: true
        });
    });

    const start = 1_800_000_000_000;
    assert.equal(
        store.consume("user-1", "chat", 2, 60_000, start).allowed,
        true
    );
    assert.equal(
        store.consume("user-1", "chat", 2, 60_000, start + 1).remaining,
        0
    );
    const blocked = store.consume("user-1", "chat", 2, 60_000, start + 2);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0);
    assert.equal(
        store.consume("user-2", "chat", 2, 60_000, start + 2).allowed,
        true
    );
    assert.equal(
        store.consume("user-1", "voice", 2, 60_000, start + 2).allowed,
        true
    );
    assert.equal(
        store.consume("user-1", "chat", 2, 60_000, start + 60_000).allowed,
        true
    );

    store.close();
    store = createSqliteUsageLimiter(databasePath);
    assert.equal(
        store.consume("user-1", "chat", 2, 60_000, start + 60_001).remaining,
        0
    );
});

test("SQLite global usage limits aggregate users and reset on daily windows", t => {

    const directory =
        mkdtempSync(path.join(os.tmpdir(), "lia-global-usage-test-"));
    const databasePath =
        path.join(directory, "usage.sqlite");
    const store = createSqliteUsageLimiter(databasePath);

    t.after(() => {
        store.close();
        rmSync(directory, {
            recursive: true,
            force: true
        });
    });

    const dayMs = 24 * 60 * 60 * 1000;
    const start = 1_800_000_000_000;
    const nextDay = (
        Math.floor(start / dayMs) + 1
    ) * dayMs;
    const consume = (user, route, now = start) => store.consumeWithGlobal(
        user,
        route,
        2,
        15 * 60 * 1000,
        2,
        dayMs,
        now
    );

    assert.equal(consume("user-1", "chat").allowed, true);
    assert.equal(consume("user-2", "chat", start + 1).allowed, true);

    const globalChatLimit = consume("user-3", "chat", start + 2);
    assert.equal(globalChatLimit.allowed, false);
    assert.equal(globalChatLimit.scope, "global");
    assert.ok(globalChatLimit.retryAfterSeconds > 0);

    assert.equal(consume("user-3", "voice", start + 2).allowed, true);

    assert.equal(consume("user-1", "voice", start + 3).allowed, true);
    assert.equal(consume("user-2", "voice", start + 6).allowed, false);

    assert.equal(consume("user-1", "voice-user-limit", start + 7).allowed, true);
    assert.equal(consume("user-1", "voice-user-limit", start + 8).allowed, true);
    assert.equal(
        consume("user-1", "voice-user-limit", start + 9).scope,
        "user"
    );

    assert.equal(
        consume("user-3", "chat", nextDay).allowed,
        true
    );
});

test("authenticated API saves, reloads and isolates user items", async t => {

    let server;

    async function startServer() {

        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");

        return `http://127.0.0.1:${server.address().port}`;
    }

    async function stopServer() {

        if (!server?.listening) {
            return;
        }

        server.closeAllConnections();

        await new Promise((resolve, reject) => {
            server.close(erro => erro ? reject(erro) : resolve());
        });
    }

    let baseUrl = await startServer();

    t.after(async () => {

        await stopServer();

        closeItemStore();
        closeObjectiveStore();
        closeSessionStore();
        closeUsageLimiter();

        rmSync(testDirectory, {
            recursive: true,
            force: true
        });
    });

    const anonymousResponse =
        await fetch(`${baseUrl}/api/itens`);

    assert.equal(
        anonymousResponse.status,
        401,
        "itens não devem ser acessíveis sem autenticação"
    );
    assert.equal(
        (await fetch(`${baseUrl}/api/objetivos`)).status,
        401,
        "objetivos não devem ser acessíveis sem autenticação"
    );

    for (const privatePath of [
        "/data/users.json",
        "/data/lia.sqlite"
    ]) {
        const response =
            await fetch(`${baseUrl}${privatePath}`);

        assert.equal(
            response.status,
            404,
            `${privatePath} não deve ser exposto como arquivo estático`
        );
    }

    async function criarSessao(email) {

        const response = await fetch(
            `${baseUrl}/api/auth/cadastro`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nome: "Conta de teste",
                    email,
                    senha: "senha-de-teste",
                    confirmarSenha: "senha-de-teste"
                })
            }
        );

        assert.equal(response.status, 201);

        const cookie =
            response.headers.get("set-cookie");

        assert.ok(cookie, "cadastro deve iniciar uma sessão");

        return cookie.split(";")[0];
    }

    const firstCookie =
        await criarSessao("teste1@example.test");

    async function fazerLogin(email, lembrarLogin) {

        return fetch(
            `${baseUrl}/api/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    senha: "senha-de-teste",
                    lembrarLogin
                })
            }
        );
    }

    const loginSemLembrar =
        await fazerLogin("teste1@example.test", false);
    assert.equal(loginSemLembrar.status, 200);

    const cookieSemLembrar =
        loginSemLembrar.headers.get("set-cookie");
    assert.ok(cookieSemLembrar);
    assert.notEqual(
        cookieSemLembrar.split(";")[0],
        firstCookie,
        "login deve emitir um novo identificador de sessão"
    );
    assert.doesNotMatch(
        cookieSemLembrar,
        /Max-Age|Expires=/i,
        "sem marcar a opção, o cookie deve durar apenas até o navegador ser fechado"
    );

    const loginLembrado =
        await fazerLogin("teste1@example.test", true);
    assert.equal(loginLembrado.status, 200);

    const cookieLembrado =
        loginLembrado.headers.get("set-cookie");
    const expiry =
        /Expires=([^;]+)/i.exec(cookieLembrado);
    assert.ok(
        expiry,
        "marcando a opção, o cookie deve ter prazo de validade"
    );
    const remainingDuration =
        Date.parse(expiry[1]) - Date.now();
    const sevenDays =
        7 * 24 * 60 * 60 * 1000;
    assert.ok(
        remainingDuration <= sevenDays &&
        remainingDuration > sevenDays - 10_000,
        "marcando a opção, o cookie deve durar sete dias"
    );

    const firstItems = [{
        id: "test-item",
        titulo: "Persistir no servidor",
        tipo: "tarefa",
        data: null,
        horario: null,
        concluido: false
    }];

    const initialLoadResponse = await fetch(
        `${baseUrl}/api/itens`,
        {
            headers: {
                Cookie: firstCookie
            }
        }
    );
    const initialData = await initialLoadResponse.json();

    const saveResponse = await fetch(
        `${baseUrl}/api/itens`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Cookie: firstCookie
            },
            body: JSON.stringify({
                itens: firstItems,
                revision: initialData.revision
            })
        }
    );

    assert.equal(saveResponse.status, 200);
    const savedData = await saveResponse.json();
    assert.equal(savedData.revision, initialData.revision + 1);

    const staleSaveResponse = await fetch(
        `${baseUrl}/api/itens`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Cookie: firstCookie
            },
            body: JSON.stringify({
                itens: [{
                    ...firstItems[0],
                    titulo: "Não deve substituir"
                }],
                revision: initialData.revision
            })
        }
    );
    assert.equal(staleSaveResponse.status, 409);
    assert.equal((await staleSaveResponse.json()).conflito, true);

    const loadResponse = await fetch(
        `${baseUrl}/api/itens`,
        {
            headers: {
                Cookie: firstCookie
            }
        }
    );

    assert.equal(loadResponse.status, 200);
    const loadedData = await loadResponse.json();
    assert.deepEqual(
        loadedData.itens,
        firstItems
    );
    assert.equal(loadedData.revision, savedData.revision);

    await stopServer();
    baseUrl = await startServer();

    const sessionAfterRestart = await fetch(
        `${baseUrl}/api/auth/me`,
        {
            headers: {
                Cookie: firstCookie
            }
        }
    );

    assert.equal(
        sessionAfterRestart.status,
        200,
        "a logged-in session should remain valid after the HTTP listener restarts"
    );
    assert.equal(
        (await sessionAfterRestart.json()).usuario.email,
        "teste1@example.test"
    );

    const secondCookie =
        await criarSessao("teste2@example.test");
    const secondUserResponse = await fetch(
        `${baseUrl}/api/itens`,
        {
            headers: {
                Cookie: secondCookie
            }
        }
    );

    assert.deepEqual(
        (await secondUserResponse.json()).itens,
        [],
        "cada conta deve ter seus próprios itens"
    );

    const createdObjectiveResponse = await fetch(
        `${baseUrl}/api/objetivos`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: firstCookie
            },
            body: JSON.stringify({
                titulo: "Concluir curso",
                etapas: ["Assistir aulas", "Fazer avaliação"]
            })
        }
    );
    assert.equal(createdObjectiveResponse.status, 201);
    const createdObjective =
        (await createdObjectiveResponse.json()).objetivo;
    assert.equal(createdObjective.progresso, 0);

    const invalidObjectiveResponse = await fetch(
        `${baseUrl}/api/objetivos`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: firstCookie
            },
            body: JSON.stringify({
                titulo: "Objetivo inválido",
                etapas: []
            })
        }
    );
    assert.equal(invalidObjectiveResponse.status, 400);

    const secondUserObjectives = await fetch(
        `${baseUrl}/api/objetivos`,
        {
            headers: {
                Cookie: secondCookie
            }
        }
    );
    assert.deepEqual(
        (await secondUserObjectives.json()).objetivos,
        [],
        "cada conta deve ter seus próprios objetivos"
    );

    const completedMilestoneResponse = await fetch(
        `${baseUrl}/api/objetivos/${createdObjective.id}/etapas/${createdObjective.etapas[0].id}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: firstCookie
            },
            body: JSON.stringify({ concluida: true })
        }
    );
    assert.equal(completedMilestoneResponse.status, 200);
    assert.equal(
        (await completedMilestoneResponse.json()).objetivo.progresso,
        50
    );

    const unauthorizedObjectiveMutation = await fetch(
        `${baseUrl}/api/objetivos/${createdObjective.id}/etapas/${createdObjective.etapas[0].id}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Cookie: secondCookie
            },
            body: JSON.stringify({ concluida: false })
        }
    );
    assert.equal(unauthorizedObjectiveMutation.status, 404);

    const addedMilestoneResponse = await fetch(
        `${baseUrl}/api/objetivos/${createdObjective.id}/etapas`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: firstCookie
            },
            body: JSON.stringify({ titulo: "Entregar projeto" })
        }
    );
    assert.equal(addedMilestoneResponse.status, 201);
    const objectiveWithAddedMilestone =
        (await addedMilestoneResponse.json()).objetivo;
    assert.equal(objectiveWithAddedMilestone.etapas.length, 3);
    assert.equal(objectiveWithAddedMilestone.progresso, 33);

    const addedMilestone =
        objectiveWithAddedMilestone.etapas.find(
            etapa => etapa.titulo === "Entregar projeto"
        );
    const deleteMilestoneResponse = await fetch(
        `${baseUrl}/api/objetivos/${createdObjective.id}/etapas/${addedMilestone.id}`,
        {
            method: "DELETE",
            headers: {
                Cookie: firstCookie
            }
        }
    );
    assert.equal(deleteMilestoneResponse.status, 200);
    assert.equal(
        (await deleteMilestoneResponse.json()).objetivo.progresso,
        50
    );

    const deleteRemainingMilestoneResponse = await fetch(
        `${baseUrl}/api/objetivos/${createdObjective.id}/etapas/${createdObjective.etapas[1].id}`,
        {
            method: "DELETE",
            headers: {
                Cookie: firstCookie
            }
        }
    );
    assert.equal(deleteRemainingMilestoneResponse.status, 200);
    const onlyMilestone =
        (await deleteRemainingMilestoneResponse.json()).objetivo.etapas[0];
    const deleteLastMilestoneResponse = await fetch(
        `${baseUrl}/api/objetivos/${createdObjective.id}/etapas/${onlyMilestone.id}`,
        {
            method: "DELETE",
            headers: {
                Cookie: firstCookie
            }
        }
    );
    assert.equal(deleteLastMilestoneResponse.status, 400);

    const deleteObjectiveResponse = await fetch(
        `${baseUrl}/api/objetivos/${createdObjective.id}`,
        {
            method: "DELETE",
            headers: {
                Cookie: firstCookie
            }
        }
    );
    assert.equal(deleteObjectiveResponse.status, 200);

    const quotaCookie =
        await criarSessao("quota@example.test");

    for (let request = 1; request <= 20; request += 1) {
        const response = await fetch(
            `${baseUrl}/api/lia`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: quotaCookie
                },
                body: JSON.stringify({
                    mensagem: ""
                })
            }
        );

        assert.equal(
            response.status,
            400,
            "mensagens inválidas contam para limitar abuso sem chamar a IA"
        );
    }

    const overLimitResponse = await fetch(
        `${baseUrl}/api/lia`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: quotaCookie
            },
            body: JSON.stringify({
                mensagem: ""
            })
        }
    );

    assert.equal(overLimitResponse.status, 429);
    assert.ok(Number(overLimitResponse.headers.get("retry-after")) > 0);

    const invalidResponse = await fetch(
        `${baseUrl}/api/itens`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Cookie: firstCookie
            },
            body: JSON.stringify({
                itens: [{
                    ...firstItems[0],
                    tipo: "desconhecido"
                }],
                revision: savedData.revision
            })
        }
    );

    assert.equal(invalidResponse.status, 400);

    const afterInvalidWrite = await fetch(
        `${baseUrl}/api/itens`,
        {
            headers: {
                Cookie: firstCookie
            }
        }
    );

    assert.deepEqual(
        (await afterInvalidWrite.json()).itens,
        firstItems,
        "uma atualização inválida deve preservar os dados válidos"
    );
});
