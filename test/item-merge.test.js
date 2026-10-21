import assert from "node:assert/strict";
import test from "node:test";

import {
    applyItemConflictChoices,
    threeWayMergeItems
} from "../modules/item-merge.js";

const item = (id, titulo, concluido = false) => ({
    id,
    titulo,
    tipo: "tarefa",
    data: null,
    horario: null,
    concluido
});

test("automatically merges independent additions, updates, and deletions", () => {

    const base = [
        item("unchanged", "Sem alteração"),
        item("update-local", "Título original"),
        item("delete-local", "Excluir local")
    ];
    const local = [
        item("unchanged", "Sem alteração"),
        item("update-local", "Atualizada localmente"),
        item("delete-server", "Excluir no servidor"),
        item("add-local", "Nova local")
    ];
    const server = [
        item("unchanged", "Sem alteração"),
        item("update-local", "Título original"),
        item("delete-local", "Excluir local"),
        item("add-server", "Nova no servidor")
    ];

    const merge = threeWayMergeItems(base, local, server);

    assert.deepEqual(merge.conflicts, []);
    assert.deepEqual(
        merge.merged.map(task => [task.id, task.titulo]),
        [
            ["unchanged", "Sem alteração"],
            ["update-local", "Atualizada localmente"],
            ["add-server", "Nova no servidor"],
            ["delete-server", "Excluir no servidor"],
            ["add-local", "Nova local"]
        ]
    );
});

test("requires an explicit choice for items changed in both versions", () => {

    const base = [item("1", "Título original")];
    const local = [item("1", "Título local")];
    const server = [item("1", "Título servidor")];
    const merge = threeWayMergeItems(base, local, server);

    assert.equal(merge.conflicts.length, 1);
    assert.throws(
        () => applyItemConflictChoices(merge, new Map()),
        /Escolha uma versão/
    );
    assert.deepEqual(
        applyItemConflictChoices(
            merge,
            new Map([["1", "server"]])
        ),
        server
    );
});

test("reports delete-versus-edit as a conflict and lets the user keep deletion", () => {

    const base = [item("1", "Tarefa original")];
    const local = [];
    const server = [item("1", "Tarefa editada no servidor")];
    const merge = threeWayMergeItems(base, local, server);

    assert.equal(merge.conflicts.length, 1);
    assert.equal(merge.conflicts[0].local, null);
    assert.deepEqual(
        applyItemConflictChoices(
            merge,
            new Map([["1", "local"]])
        ),
        []
    );
});
