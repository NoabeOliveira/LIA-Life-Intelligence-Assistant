import assert from "node:assert/strict";
import test from "node:test";

import { createTasksPage } from "../modules/tasks-page.js";

class ElementMock {

    constructor() {
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.className = "";
        this.classList = {
            values: new Set(),
            add: value => this.classList.values.add(value)
        };
        this.textContent = "";
    }

    addEventListener(type, listener) {
        this.listeners[type] = listener;
    }

    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    append(...elements) {
        this.children.push(...elements);
    }

    appendChild(element) {
        this.children.push(element);
    }

    replaceChildren(...elements) {
        this.children = [...elements];
    }

    reset() {
        this.wasReset = true;
    }

    focus() {
        this.wasFocused = true;
    }
}

test("renders task filters and task actions, including completion status", () => {

    const elements = new Map(
        ["taskCreateForm", "taskTitle", "taskDate", "taskTime", "taskPageList", "taskFilters"]
            .map(id => [id, new ElementMock()])
    );
    const tasks = [
        {
            id: "task-open",
            titulo: "Preparar apresentação",
            tipo: "tarefa",
            data: "2026-10-22",
            horario: "09:30",
            concluido: false
        },
        {
            id: "task-done",
            titulo: "Enviar relatório",
            tipo: "tarefa",
            data: null,
            horario: null,
            concluido: true
        },
        {
            id: "event",
            titulo: "Consulta",
            tipo: "compromisso",
            data: null,
            horario: null,
            concluido: false
        }
    ];
    const calls = [];
    const page = createTasksPage({
        getItems: () => tasks,
        onCreateTask: task => {
            calls.push(["create", task]);
            return true;
        },
        onToggleTask: id => calls.push(["toggle", id]),
        onDeleteTask: id => calls.push(["delete", id]),
        documentRef: {
            getElementById: id => elements.get(id) || null,
            createElement: () => new ElementMock()
        }
    });

    page.render();

    const filters = elements.get("taskFilters");
    const list = elements.get("taskPageList");
    assert.equal(filters.children.length, 3);
    assert.equal(filters.children[0].attributes["aria-pressed"], "true");
    assert.equal(list.children.length, 2);
    assert.equal(list.children[0].children[1].children[0].textContent, "Preparar apresentação");
    assert.equal(list.children[0].children[1].children[1].textContent, "22/10/2026 • 09:30");
    assert.equal(list.children[1].classList.values.has("completed"), true);

    list.children[0].children[0].listeners.click();
    list.children[0].children[2].listeners.click();
    assert.deepEqual(calls, [
        ["toggle", "task-open"],
        ["delete", "task-open"]
    ]);

    filters.children[1].listeners.click();
    assert.equal(filters.children[1].attributes["aria-pressed"], "true");
    assert.equal(elements.get("taskPageList").children.length, 1);
    assert.equal(
        elements.get("taskPageList").children[0].children[1].children[0].textContent,
        "Preparar apresentação"
    );
});

test("submits valid task data and resets the form after creation", () => {

    const elements = new Map(
        ["taskCreateForm", "taskTitle", "taskDate", "taskTime", "taskPageList", "taskFilters"]
            .map(id => [id, new ElementMock()])
    );
    elements.get("taskTitle").value = "Revisar proposta";
    elements.get("taskDate").value = "2026-10-23";
    elements.get("taskTime").value = "14:00";
    let createdTask;

    createTasksPage({
        getItems: () => [],
        onCreateTask: task => {
            createdTask = task;
            return true;
        },
        onToggleTask() {},
        onDeleteTask() {},
        documentRef: {
            getElementById: id => elements.get(id) || null,
            createElement: () => new ElementMock()
        }
    });

    elements.get("taskCreateForm").listeners.submit({
        preventDefault() {}
    });

    assert.deepEqual(createdTask, {
        titulo: "Revisar proposta",
        data: "2026-10-23",
        horario: "14:00"
    });
    assert.equal(elements.get("taskCreateForm").wasReset, true);
    assert.equal(elements.get("taskTitle").wasFocused, true);
});
