import {
    extrairMensagemErroApi,
    mostrarMensagemAuth
} from "./ux.js";

export function createAuthUi({
    showApplication,
    showAuthentication,
    waitForPendingSaves,
    beforeLogout,
    fetcher = fetch,
    documentRef = document
}) {

    const elements = {
        loginCard: documentRef.getElementById("loginCard"),
        cadastroCard: documentRef.getElementById("cadastroCard"),
        loginForm: documentRef.getElementById("loginForm"),
        cadastroForm: documentRef.getElementById("cadastroForm"),
        loginEmail: documentRef.getElementById("loginEmail"),
        loginSenha: documentRef.getElementById("loginSenha"),
        lembrarLogin: documentRef.getElementById("lembrarLogin"),
        cadastroNome: documentRef.getElementById("cadastroNome"),
        cadastroEmail: documentRef.getElementById("cadastroEmail"),
        cadastroSenha: documentRef.getElementById("cadastroSenha"),
        cadastroConfirmarSenha:
            documentRef.getElementById("cadastroConfirmarSenha"),
        aceitarTermos: documentRef.getElementById("aceitarTermos"),
        loginMensagem: documentRef.getElementById("loginMensagem"),
        cadastroMensagem: documentRef.getElementById("cadastroMensagem"),
        abrirCadastro: documentRef.getElementById("abrirCadastro"),
        abrirLogin: documentRef.getElementById("abrirLogin"),
        btnLogout: documentRef.getElementById("btnLogout"),
        esqueciSenha: documentRef.getElementById("esqueciSenha"),
        entrarGoogle: documentRef.getElementById("entrarGoogle"),
        entrarApple: documentRef.getElementById("entrarApple")
    };

    function limparMensagens() {
        mostrarMensagemAuth(elements.loginMensagem, "");
        mostrarMensagemAuth(elements.cadastroMensagem, "");
    }

    function showLogin() {

        elements.loginCard?.classList.remove("hidden");
        elements.cadastroCard?.classList.add("hidden");
        limparMensagens();
    }

    function showCadastro() {

        elements.loginCard?.classList.add("hidden");
        elements.cadastroCard?.classList.remove("hidden");
        limparMensagens();
    }

    function mostrarErro(elemento, erro, fallback) {

        mostrarMensagemAuth(
            elemento,
            erro instanceof Error && erro.message ?
                erro.message :
                fallback
        );
    }

    async function cadastrarUsuario(evento) {

        evento.preventDefault();
        limparMensagens();

        const nome = elements.cadastroNome?.value.trim();
        const email = elements.cadastroEmail?.value.trim();
        const senha = elements.cadastroSenha?.value || "";
        const confirmarSenha =
            elements.cadastroConfirmarSenha?.value || "";

        if (!nome) {
            mostrarMensagemAuth(elements.cadastroMensagem, "Digite seu nome.");
            return;
        }

        if (!email) {
            mostrarMensagemAuth(elements.cadastroMensagem, "Digite seu e-mail.");
            return;
        }

        if (senha.length < 6) {
            mostrarMensagemAuth(
                elements.cadastroMensagem,
                "A senha deve possuir pelo menos 6 caracteres."
            );
            return;
        }

        if (senha !== confirmarSenha) {
            mostrarMensagemAuth(
                elements.cadastroMensagem,
                "As senhas não são iguais."
            );
            return;
        }

        if (elements.aceitarTermos && !elements.aceitarTermos.checked) {
            mostrarMensagemAuth(
                elements.cadastroMensagem,
                "Você precisa aceitar os termos para continuar."
            );
            return;
        }

        const botao = elements.cadastroForm?.querySelector(
            'button[type="submit"]'
        );

        try {

            if (botao) {
                botao.disabled = true;
                botao.textContent = "Criando conta...";
            }

            const resposta = await fetcher("/api/auth/cadastro", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    nome,
                    email,
                    senha,
                    confirmarSenha
                })
            });
            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(extrairMensagemErroApi(
                    dados,
                    "Não foi possível criar a conta."
                ));
            }

            mostrarMensagemAuth(
                elements.cadastroMensagem,
                "Conta criada com sucesso!",
                "success"
            );
            elements.cadastroForm?.reset();
            await showApplication(dados.usuario);

        } catch (erro) {

            console.error("Erro no cadastro:", erro);
            mostrarErro(
                elements.cadastroMensagem,
                erro,
                "Não foi possível criar sua conta."
            );

        } finally {

            if (botao) {
                botao.disabled = false;
                botao.innerHTML = `Criar conta <span>→</span>`;
            }
        }
    }

    async function realizarLogin(evento) {

        evento.preventDefault();
        limparMensagens();

        const email = elements.loginEmail?.value.trim();
        const senha = elements.loginSenha?.value || "";

        if (!email || !senha) {
            mostrarMensagemAuth(
                elements.loginMensagem,
                "Informe seu e-mail e sua senha."
            );
            return;
        }

        const botao = elements.loginForm?.querySelector(
            'button[type="submit"]'
        );

        try {

            if (botao) {
                botao.disabled = true;
                botao.textContent = "Entrando...";
            }

            const resposta = await fetcher("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    email,
                    senha,
                    lembrarLogin: Boolean(elements.lembrarLogin?.checked)
                })
            });
            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(extrairMensagemErroApi(
                    dados,
                    "Não foi possível entrar."
                ));
            }

            elements.loginForm?.reset();
            await showApplication(dados.usuario);

        } catch (erro) {

            console.error("Erro no login:", erro);
            mostrarErro(
                elements.loginMensagem,
                erro,
                "Não foi possível realizar o login."
            );

        } finally {

            if (botao) {
                botao.disabled = false;
                botao.innerHTML = `Entrar <span>→</span>`;
            }
        }
    }

    async function realizarLogout() {

        try {

            await waitForPendingSaves();
            await beforeLogout();
            await fetcher("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

        } catch (erro) {

            console.error("Erro ao sair:", erro);

        } finally {

            showAuthentication();
        }
    }

    async function verificarSessao() {

        try {

            const resposta = await fetcher("/api/auth/me", {
                method: "GET",
                credentials: "same-origin"
            });

            if (!resposta.ok) {
                showAuthentication();
                return;
            }

            const dados = await resposta.json();

            if (dados.autenticado && dados.usuario) {
                await showApplication(dados.usuario);
                return;
            }

            showAuthentication();

        } catch (erro) {

            console.error("Erro ao verificar sessão:", erro);
            showAuthentication();
        }
    }

    function configurarBotoesSenha() {

        documentRef.querySelectorAll(".toggle-password").forEach(botao => {

            botao.addEventListener("click", () => {

                const campo = documentRef.getElementById(botao.dataset.target);

                if (!campo) {
                    return;
                }

                if (campo.type === "password") {
                    campo.type = "text";
                    botao.textContent = "○";
                } else {
                    campo.type = "password";
                    botao.textContent = "◉";
                }
            });
        });
    }

    function bind() {

        elements.abrirCadastro?.addEventListener("click", showCadastro);
        elements.abrirLogin?.addEventListener("click", showLogin);
        elements.loginForm?.addEventListener("submit", realizarLogin);
        elements.cadastroForm?.addEventListener("submit", cadastrarUsuario);
        elements.btnLogout?.addEventListener("click", realizarLogout);

        elements.esqueciSenha?.addEventListener("click", () => {
            mostrarMensagemAuth(
                elements.loginMensagem,
                "A recuperação de senha será implementada na próxima etapa."
            );
        });

        elements.entrarGoogle?.addEventListener("click", () => {
            mostrarMensagemAuth(
                elements.loginMensagem,
                "A autenticação com Google ainda não está disponível."
            );
        });

        elements.entrarApple?.addEventListener("click", () => {
            mostrarMensagemAuth(
                elements.loginMensagem,
                "A autenticação com Apple ainda não está disponível."
            );
        });
    }

    return {
        bind,
        configurarBotoesSenha,
        verificarSessao,
        showLogin,
        mostrarMensagemLogin(texto) {
            mostrarMensagemAuth(elements.loginMensagem, texto);
        }
    };
}
