import assert from "node:assert/strict";
import test from "node:test";

import { createObjectivesPage } from "../modules/objectives-page.js";

class ElementMock {

    constructor() {
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.className = "";
        this.classList = {
            values: new Set(),
            add: value => this.classList.values.add(value),
            toggle: (value, enabled) => {
                if (enabled) {
                    this.classList.values.add(value);
                } else {
                    this.classList.values.delete(value);
                }
            }
        };
        this.style = {};
        this.hidden = false;
        this.textContent = "";
        this.value = "";
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

    querySelectorAll() {
        return [];
    }

    reset() {
        this.wasReset = true;
    }

    focus() {
        this.wasFocused = true;
    }
}

function createFixture(fetcher) {

    const ids = [
        "objetivosPage",
        "objectiveCreateForm",
        "objectiveTitle",
        "objectiveDeadline",
        "objectiveMilestones",
        "objectiveList",
        "objectiveStatus",
        "objectiveStatusText",
        "objectiveRetryLoad",
        "dashboardObjectiveSummary",
        "voltarMeuDiaObjetivos"
    ];
    const elements = new Map(
        ids.map(id => [id, new ElementMock()])
    );

    return {
        elements,
        page: createObjectivesPage({
            fetcher,
            confirmAction: () => true,
            documentRef: {
                getElementById: id => elements.get(id) || null,
                createElement: () => new ElementMock()
            }
        })
    };
}

function response(status, data) {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => data
    };
}

test("loads and creates an objective with derived milestone progress", async () => {

    const requests = [];
    const objective = {
        id: "objective-1",
        titulo: "Concluir curso",
        dataLimite: null,
        criadoEm: "2026-10-21T12:00:00.000Z",
        etapas: [
            { id: "milestone-1", titulo: "Assistir aulas", concluida: true },
            { id: "milestone-2", titulo: "Fazer avaliação", concluida: false }
        ],
        progresso: 50
    };
    const fixture = createFixture(async (url, options) => {
        requests.push({ url, options });

        if (options.method === "POST") {
            return response(201, { objetivo: objective });
        }

        return response(200, { objetivos: [] });
    });

    await fixture.page.load();
    assert.equal(
        fixture.elements.get("dashboardObjectiveSummary").textContent,
        "Defina um objetivo e transforme-o em etapas."
    );

    fixture.elements.get("objectiveTitle").value = "Concluir curso";
    fixture.elements.get("objectiveDeadline").value = "";
    fixture.elements.get("objectiveMilestones").value =
        "Assistir aulas\nFazer avaliação";

    await fixture.elements.get("objectiveCreateForm").listeners.submit({
        preventDefault() {}
    });

    assert.equal(requests.length, 2);
    assert.deepEqual(
        JSON.parse(requests[1].options.body),
        {
            titulo: "Concluir curso",
            dataLimite: null,
            etapas: ["Assistir aulas", "Fazer avaliação"]
        }
    );
    assert.equal(
        fixture.elements.get("objectiveCreateForm").wasReset,
        true,
        fixture.elements.get("objectiveStatusText").textContent
    );
    assert.equal(
        fixture.elements.get("objectiveTitle").wasFocused,
        true
    );

    const card =
        fixture.elements.get("objectiveList").children[0];
    assert.equal(card.children[0].children[0].children[0].textContent, "Concluir curso");
    assert.equal(card.children[1].children[1].textContent, "50%");
    assert.equal(card.children[2].attributes["aria-valuenow"], "50");
    assert.equal(
        fixture.elements.get("dashboardObjectiveSummary").textContent,
        "1 objetivo(s) em acompanhamento · 0 concluído(s)."
    );
});

test("shows load errors and retries when requested", async () => {

    let attempts = 0;
    const fixture = createFixture(async () => {
        attempts += 1;
        return attempts === 1 ?
            response(503, { erro: "Serviço indisponível." }) :
            response(200, { objetivos: [] });
    });

    await fixture.page.load();
    assert.equal(attempts, 1);
    assert.equal(
        fixture.elements.get("objectiveStatusText").textContent,
        "Serviço indisponível."
    );
    assert.equal(
        fixture.elements.get("objectiveRetryLoad").hidden,
        false
    );

    await fixture.elements.get("objectiveRetryLoad").listeners.click();
    assert.equal(attempts, 2);
    assert.equal(
        fixture.elements.get("objectiveRetryLoad").hidden,
        true
    );
    assert.equal(
        fixture.elements.get("objectiveStatus").hidden,
        true
    );
});
