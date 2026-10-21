import assert from "node:assert/strict";
import test from "node:test";

import { createAuthUi } from "../modules/auth-ui.js";

class FakeElement {

    constructor() {
        this.listeners = new Map();
        this.classes = new Set();
        this.dataset = {};
        this.checked = false;
        this.disabled = false;
        this.type = "";
        this.value = "";
        this.textContent = "";
        this.innerHTML = "";
    }

    addEventListener(event, listener) {

        const listeners = this.listeners.get(event) || [];
        listeners.push(listener);
        this.listeners.set(event, listeners);
    }

    async emit(event, details = {}) {

        const handlers = this.listeners.get(event) || [];

        for (const handler of handlers) {
            await handler({
                preventDefault() {},
                ...details
            });
        }
    }

    querySelector() {
        return new FakeElement();
    }

    reset() {
        this.wasReset = true;
    }

    classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name)
    };
}

function createDocument() {

    const ids = [
        "loginCard",
        "cadastroCard",
        "loginForm",
        "cadastroForm",
        "loginEmail",
        "loginSenha",
        "lembrarLogin",
        "cadastroNome",
        "cadastroEmail",
        "cadastroSenha",
        "cadastroConfirmarSenha",
        "aceitarTermos",
        "loginMensagem",
        "cadastroMensagem",
        "abrirCadastro",
        "abrirLogin",
        "btnLogout",
        "esqueciSenha",
        "entrarGoogle",
        "entrarApple"
    ];
    const elements = new Map(ids.map(id => [id, new FakeElement()]));

    return {
        elements,
        getElementById: id => elements.get(id) || null,
        querySelectorAll: () => []
    };
}

function createResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        async json() {
            return body;
        }
    };
}

test("auth controller handles registration, login, and logout", async () => {

    const documentRef = createDocument();
    const requests = [];
    const authenticatedUsers = [];
    const lifecycle = [];
    const auth = createAuthUi({
        documentRef,
        async fetcher(url, options) {

            requests.push({ url, options });

            if (url === "/api/auth/cadastro") {
                return createResponse(201, {
                    usuario: { id: "user-1", nome: "Pessoa" }
                });
            }

            if (url === "/api/auth/login") {
                return createResponse(200, {
                    usuario: { id: "user-1", nome: "Pessoa" }
                });
            }

            return createResponse(200, {});
        },
        async showApplication(user) {
            authenticatedUsers.push(user);
        },
        showAuthentication() {
            lifecycle.push("show-authentication");
        },
        async waitForPendingSaves() {
            lifecycle.push("wait-for-saves");
        },
        async beforeLogout() {
            lifecycle.push("before-logout");
        }
    });

    auth.bind();

    const elements = documentRef.elements;
    elements.get("cadastroNome").value = "Pessoa";
    elements.get("cadastroEmail").value = "pessoa@example.test";
    elements.get("cadastroSenha").value = "senha-segura";
    elements.get("cadastroConfirmarSenha").value = "senha-segura";
    elements.get("aceitarTermos").checked = true;
    await elements.get("cadastroForm").emit("submit");

    elements.get("loginEmail").value = "pessoa@example.test";
    elements.get("loginSenha").value = "senha-segura";
    elements.get("lembrarLogin").checked = true;
    await elements.get("loginForm").emit("submit");
    await elements.get("btnLogout").emit("click");

    assert.deepEqual(
        requests.map(({ url }) => url),
        [
            "/api/auth/cadastro",
            "/api/auth/login",
            "/api/auth/logout"
        ]
    );
    assert.deepEqual(
        JSON.parse(requests[0].options.body),
        {
            nome: "Pessoa",
            email: "pessoa@example.test",
            senha: "senha-segura",
            confirmarSenha: "senha-segura"
        }
    );
    assert.equal(
        JSON.parse(requests[1].options.body).lembrarLogin,
        true
    );
    assert.equal(authenticatedUsers.length, 2);
    assert.deepEqual(
        lifecycle,
        [
            "wait-for-saves",
            "before-logout",
            "show-authentication"
        ]
    );
});

test("auth controller switches forms and validates empty credentials", async () => {

    const documentRef = createDocument();
    const auth = createAuthUi({
        documentRef,
        async fetcher() {
            throw new Error("A requisição não deveria acontecer.");
        },
        async showApplication() {},
        showAuthentication() {},
        async waitForPendingSaves() {},
        async beforeLogout() {}
    });

    auth.bind();

    const elements = documentRef.elements;
    await elements.get("abrirCadastro").emit("click");

    assert.equal(elements.get("loginCard").classes.has("hidden"), true);
    assert.equal(elements.get("cadastroCard").classes.has("hidden"), false);

    await elements.get("abrirLogin").emit("click");
    await elements.get("loginForm").emit("submit");

    assert.equal(elements.get("loginCard").classes.has("hidden"), false);
    assert.equal(elements.get("cadastroCard").classes.has("hidden"), true);
    assert.equal(
        elements.get("loginMensagem").textContent,
        "Informe seu e-mail e sua senha."
    );
});
