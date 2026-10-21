import assert from "node:assert/strict";
import test from "node:test";

import {
    buscarItemSemelhante,
    encontrarItemDuplicado,
    pontuarSemelhancaItem
} from "../modules/item-domain.js";

test("matches item names ignoring accents and case", () => {

    const item = {
        id: "1",
        titulo: "Revisar a apresentação"
    };

    assert.equal(
        pontuarSemelhancaItem(
            item.titulo,
            "APRESENTACAO"
        ),
        80
    );

    assert.equal(
        buscarItemSemelhante(
            [item],
            "apresentacao"
        ),
        item
    );

    assert.equal(
        buscarItemSemelhante(
            [item],
            "consulta médica"
        ),
        null
    );
});

test("detects duplicates only when type, date, time, and title match", () => {

    const existing = {
        id: "1",
        titulo: "Estudar",
        tipo: "tarefa",
        data: "2026-10-20",
        horario: "09:00"
    };

    assert.equal(
        encontrarItemDuplicado(
            [existing],
            { ...existing, id: "2" }
        ),
        existing
    );

    assert.equal(
        encontrarItemDuplicado(
            [existing],
            { ...existing, tipo: "compromisso" }
        ),
        null
    );

    assert.equal(
        encontrarItemDuplicado(
            [existing],
            { ...existing, horario: "10:00" }
        ),
        null
    );
});
