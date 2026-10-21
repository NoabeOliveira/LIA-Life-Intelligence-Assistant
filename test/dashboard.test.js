import assert from "node:assert/strict";
import test from "node:test";

import { createDashboardRenderer } from "../modules/dashboard.js";
import { dataDeHoje } from "../modules/date-utils.js";

class ElementMock {

    constructor() {
        this.children = [];
        this.className = "";
        this.classList = {
            values: new Set(),
            add: value => this.classList.values.add(value)
        };
        this.textContent = "";
        this.html = "";
    }

    set innerHTML(value) {
        this.html = value;
        this.children = [];
    }

    get innerHTML() {
        return this.html;
    }

    appendChild(child) {
        this.children.push(child);
    }
}

test("renders task and agenda lists and their dashboard summaries", () => {

    const elements = new Map(
        [
            "listaTarefas",
            "listaAgenda",
            "totalHoje",
            "totalAmanha",
            "totalAgenda",
            "resumoTarefasHoje",
            "resumoCompromissosHoje",
            "resumoTarefasAbertas",
            "resumoTarefasConcluidas",
            "planoHoje"
        ].map(id => [id, new ElementMock()])
    );
    const hoje = dataDeHoje();
    const itens = [
        {
            id: "task-later",
            titulo: "Tarefa mais tarde",
            tipo: "tarefa",
            data: hoje,
            horario: "10:00",
            concluido: false
        },
        {
            id: "task-first",
            titulo: "Tarefa mais cedo",
            tipo: "tarefa",
            data: hoje,
            horario: "09:00",
            concluido: false
        },
        {
            id: "task-done",
            titulo: "Tarefa concluída",
            tipo: "tarefa",
            data: hoje,
            horario: "08:00",
            concluido: true
        },
        {
            id: "event",
            titulo: "Consulta",
            tipo: "compromisso",
            data: hoje,
            horario: "11:00",
            concluido: false
        }
    ];

    const renderer = createDashboardRenderer({
        getItems: () => itens,
        onCreateTask() {},
        onPlanToday() {},
        documentRef: {
            getElementById: id => elements.get(id) || null,
            createElement: () => new ElementMock()
        }
    });

    renderer.render();

    const taskList = elements.get("listaTarefas");
    assert.equal(taskList.children.length, 3);
    assert.equal(taskList.children[0].children[0].textContent, "Tarefa mais cedo");
    assert.equal(taskList.children[2].children[0].textContent, "Tarefa concluída");
    assert.ok(taskList.children[2].classList.values.has("concluido"));

    assert.equal(elements.get("listaAgenda").children.length, 1);
    assert.equal(
        elements.get("listaAgenda").children[0].children[0].textContent,
        "Consulta"
    );
    assert.equal(elements.get("totalHoje").textContent, 1);
    assert.equal(elements.get("totalAmanha").textContent, 0);
    assert.equal(elements.get("totalAgenda").textContent, 1);
    assert.equal(elements.get("resumoTarefasHoje").textContent, 2);
    assert.equal(elements.get("resumoCompromissosHoje").textContent, 1);
    assert.equal(elements.get("resumoTarefasAbertas").textContent, 2);
    assert.equal(elements.get("resumoTarefasConcluidas").textContent, 1);

    const timeline = elements.get("planoHoje");
    assert.equal(timeline.children.length, 3);
    assert.equal(
        timeline.children[0].children[2].children[0].textContent,
        "Tarefa mais cedo"
    );
});
