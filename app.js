import {
    buscarItemSemelhante,
    encontrarItemDuplicado
} from "./modules/item-domain.js";

import {
    createItemSync
} from "./modules/item-sync.js";

import {
    criarDataLocal,
    formatarDataBrasileira,
    formatarDataISO
} from "./modules/date-utils.js";
import { createDashboardRenderer } from "./modules/dashboard.js";
import { createTasksPage } from "./modules/tasks-page.js";
import { createItemConflictReview } from "./modules/item-conflict-review.js";
import { createObjectivesPage } from "./modules/objectives-page.js";
import { createAuthUi } from "./modules/auth-ui.js";
import { createVoiceController } from "./modules/voice-controller.js";

                                                         
                                    
         
                                                         


                                                         
                              
                                                         

const authPage =
    document.getElementById("authPage");

const appPrincipal =
    document.getElementById("appPrincipal");


                                                         
                         
                                                         

const nomeUsuarioSidebar =
    document.getElementById(
        "nomeUsuarioSidebar"
    );

const nomeUsuarioCabecalho =
    document.getElementById(
        "nomeUsuarioCabecalho"
    );

const avatarUsuario =
    document.getElementById(
        "avatarUsuario"
    );

const saudacaoUsuario =
    document.getElementById(
        "saudacaoUsuario"
    );


                                                         
                     
                                                         

const mensagemLia =
    document.getElementById("mensagemLia");

const enviarMensagem =
    document.getElementById(
        "enviarMensagem"
    );

const microfone =
    document.getElementById("microfone");

const btnToggleVoz =
    document.getElementById("btnToggleVoz");

const novoCompromisso =
    document.getElementById(
        "novoCompromisso"
    );


                                                         
                           
                                                         

const atalhoCriarTarefa =
    document.getElementById(
        "atalhoCriarTarefa"
    );

const atalhoAgendar =
    document.getElementById(
        "atalhoAgendar"
    );

const atalhoOrganizarDia =
    document.getElementById(
        "atalhoOrganizarDia"
    );

const atalhoInsight =
    document.getElementById(
        "atalhoInsight"
    );

const verAgendaCompleta =
    document.getElementById(
        "verAgendaCompleta"
    );

const verTodasTarefas =
    document.getElementById(
        "verTodasTarefas"
    );

const verObjetivos =
    document.getElementById("verObjetivos");


                                                         
                           
                                                         

const btnMeuDia =
    document.getElementById("btnMeuDia");

const btnAgenda =
    document.getElementById("btnAgenda");

const btnTarefas =
    document.getElementById("btnTarefas");

const btnObjetivos =
    document.getElementById("btnObjetivos");

const btnNotas =
    document.getElementById("btnNotas");

const btnLiaAi =
    document.getElementById("btnLiaAi");

const btnConfiguracoes =
    document.getElementById(
        "btnConfiguracoes"
    );

const meuDiaPage =
    document.getElementById(
        "meuDiaPage"
    );

const agendaPage =
    document.getElementById(
        "agendaPage"
    );

const tarefasPage =
    document.getElementById("tarefasPage");
const objetivosPageElement =
    document.getElementById("objetivosPage");
const voltarMeuDiaTarefas =
    document.getElementById("voltarMeuDiaTarefas");
const syncConflictDialog =
    document.getElementById("syncConflictDialog");


                                                         
                      
                                                         

let usuarioAtual = null;

let itens = [];

let reconhecimento = null;

let dadosServidorProntos = false;
let conflictReview;

const itemSync = createItemSync({
    getUserId: () => usuarioAtual?.id,
    getItems: () => itens,
    isReady: () => dadosServidorProntos,
    setStatus: mostrarStatusSincronizacao,
    onConflict: conflito => {
        definirDisponibilidadeDados(false);
        conflictReview?.show(conflito);
    },
    storage: localStorage
});

conflictReview = createItemConflictReview({
    dialog: syncConflictDialog,
    onRefresh: () => itemSync.refreshConflict(),
    async onResolve(mergedItems) {

        const resultado =
            await itemSync.resolveConflict(mergedItems);

        if (resultado.conflito) {
            itens = resultado.itens;
            mostrarStatusSincronizacao(
                "O servidor mudou novamente. Revise as novas diferenças; sua combinação continua preservada.",
                true,
                true,
                "Revisar alterações"
            );
            definirDisponibilidadeDados(false);
            atualizarInterface();
            return resultado.conflito;
        }

        itens = resultado.itens;
        definirDisponibilidadeDados(true);
        atualizarInterface();
        mostrarStatusSincronizacao("");
        return null;
    }
});

const dashboard = createDashboardRenderer({
    getItems: () => itens,
    onCreateTask: () => {

        if (!mensagemLia) {
            return;
        }

        mensagemLia.value = "Crie uma tarefa para hoje: ";
        mensagemLia.focus();
    },
    onPlanToday: () => enviarComandoRapido(
        "Ajude-me a planejar meu dia de hoje."
    )
});

const tasksPageRenderer = createTasksPage({
    getItems: () => itens,
    onCreateTask: criarTarefaPelaPagina,
    onToggleTask: alternarConclusaoTarefa,
    onDeleteTask: excluirTarefaPelaPagina
});

const objectivesPage = createObjectivesPage({
    onAuthenticationExpired: mostrarAutenticacao
});


                                                         
                          
                                                         

function obterSaudacao() {

    const hora =
        new Date().getHours();

    if (hora < 12) {
        return "Bom dia";
    }

    if (hora < 18) {
        return "Boa tarde";
    }

    return "Boa noite";
}


function atualizarDataCabecalho() {

    const elementoData =
        document.getElementById(
            "dataAtual"
        );

    if (!elementoData) {
        return;
    }

    const hoje =
        new Date();

    let texto =
        hoje.toLocaleDateString(
            "pt-BR",
            {
                weekday: "long",
                day: "2-digit",
                month: "long"
            }
        );

    texto =
        texto.charAt(0)
            .toUpperCase() +
        texto.slice(1);

    elementoData.textContent =
        texto;
}


function atualizarUsuarioVisual() {

    if (!usuarioAtual) {
        return;
    }

    const nome =
        usuarioAtual.nome ||
        "Usuário";

    const primeiroNome =
        nome.trim()
            .split(/\s+/)[0];

    if (nomeUsuarioSidebar) {

        nomeUsuarioSidebar.textContent =
            primeiroNome;
    }

    if (nomeUsuarioCabecalho) {

        nomeUsuarioCabecalho.textContent =
            primeiroNome;
    }

    if (avatarUsuario) {

        avatarUsuario.textContent =
            primeiroNome
                .charAt(0)
                .toUpperCase();
    }

    if (saudacaoUsuario) {

        saudacaoUsuario.textContent =
            obterSaudacao();
    }
}


function mostrarStatusSincronizacao(
    mensagem,
    erro = false,
    permitirRepetir = false,
    textoBotao = "Tentar novamente"
) {

    [
        ["syncStatus", "syncStatusText", "retrySync"],
        ["taskSyncStatus", "taskSyncStatusText", "taskRetrySync"]
    ].forEach(([statusId, textId, retryId]) => {

        const status = document.getElementById(statusId);
        const texto = document.getElementById(textId);
        const repetir = document.getElementById(retryId);

        if (!status || !texto || !repetir) {
            return;
        }

        texto.textContent = mensagem;
        status.hidden = !mensagem;
        status.classList.toggle("sync-error", erro);
        repetir.hidden = !permitirRepetir;
        repetir.textContent = textoBotao;
    });
}

function definirDisponibilidadeDados(disponivel) {

    dadosServidorProntos = disponivel;

    const controles = [
        mensagemLia,
        enviarMensagem,
        microfone,
        atalhoCriarTarefa,
        atalhoAgendar,
        atalhoOrganizarDia,
        atalhoInsight,
        novoCompromisso,
        document.getElementById("taskTitle"),
        document.getElementById("taskDate"),
        document.getElementById("taskTime"),
        document.getElementById("taskCreateButton")
    ];

    const controlesDisponiveis = [
        ...controles,
        ...document.querySelectorAll(
            "#atalhoCriarTarefaVazia, #atalhoOrganizarDiaVazio"
        )
    ];

    controlesDisponiveis.forEach(controle => {

        if (controle) {
            controle.disabled = !disponivel;
        }
    });
}

async function carregarDados() {

    if (!usuarioAtual?.id) {
        throw new Error(
            "Não foi possível identificar a conta para carregar os dados."
        );
    }

    return itemSync.load(usuarioAtual.id);
}

function salvarDados() {
    return itemSync.save();
}


                                                         
                               
                                                         

function mostrarAutenticacao() {

    usuarioAtual = null;
    itens = [];
    definirDisponibilidadeDados(false);
    mostrarStatusSincronizacao("");
    appPrincipal?.classList.add("hidden");
    authPage?.classList.remove("hidden");
    authUi.showLogin();
}


                                                         
                        
                                                         

async function mostrarAplicacao(
    usuario
) {

    usuarioAtual =
        usuario;

    if (authPage) {

        authPage.classList.add(
            "hidden"
        );
    }

    if (appPrincipal) {

        appPrincipal.classList.remove(
            "hidden"
        );
    }

    atualizarUsuarioVisual();

    atualizarDataCabecalho();

    itens = [];
    definirDisponibilidadeDados(false);
    mostrarStatusSincronizacao(
        "Carregando seus dados..."
    );

    try {
        itens = await carregarDados();
        const conflito = itemSync.getConflict();

        if (conflito) {
            definirDisponibilidadeDados(false);
            mostrarStatusSincronizacao(
                "Suas alterações locais foram preservadas. Revise as versões antes de salvar.",
                true,
                true,
                conflito.server ?
                    "Revisar alterações" :
                    "Carregar versão do servidor"
            );
        } else {
            definirDisponibilidadeDados(true);
            mostrarStatusSincronizacao("");
        }
    } catch (erro) {
        console.error(
            "Erro ao carregar dados do servidor:",
            erro
        );

        mostrarStatusSincronizacao(
            `Não foi possível carregar seus dados: ${erro.message}`,
            true,
            true
        );
    }

    atualizarInterface();

    if (!dadosServidorProntos) {
        definirDisponibilidadeDados(false);
    }

    abrirMeuDia();
    await objectivesPage.load();

    const conflitoPendente = itemSync.getConflict();
    if (conflitoPendente) {
        conflictReview.show(conflitoPendente);
    }

    responder(
        `Olá, ${
            usuarioAtual.nome
                .trim()
                .split(/\s+/)[0]
        }. Como posso ajudar você hoje?`
    );
}

const authUi = createAuthUi({
    showApplication: mostrarAplicacao,
    showAuthentication: mostrarAutenticacao,
    waitForPendingSaves: () => itemSync.waitForPendingSaves(),
    beforeLogout: () => {
        voiceController.parar();
    }
});


                                                         
                      
                                                         

function responder(texto) {

    let respostaElemento =
        document.getElementById(
            "respostaLia"
        );

    if (!respostaElemento) {

        respostaElemento =
            document.querySelector(
                ".resposta-lia"
            );
    }

    if (!respostaElemento) {

        respostaElemento =
            document.createElement(
                "p"
            );

        respostaElemento.id =
            "respostaLia";

        respostaElemento.className =
            "resposta-lia";

        if (
            mensagemLia &&
            mensagemLia.parentElement
        ) {

            mensagemLia
                .parentElement
                .parentElement
                ?.appendChild(
                    respostaElemento
                );
        }
    }

    if (respostaElemento) {

        respostaElemento.textContent =
            texto || "";
    }
}


const voiceController = createVoiceController({
    button: btnToggleVoz
});

function atualizarEstadoVozLia() {
    voiceController.atualizarBotao();
}

function pararVozLia() {
    voiceController.parar();
}

function falar(texto, estadoEmocional = "neutro") {
    return voiceController.falar(texto, estadoEmocional);
}


                                                         
                   
                                                         

function normalizar(texto) {

    if (!texto) {
        return "";
    }

    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .trim();
}


function encontrarItem(busca) {

    return buscarItemSemelhante(
        itens,
        busca
    );
}


                                                         
                 
                                                         

function criarItem(
    titulo,
    tipo,
    data = null,
    horario = null
) {

    if (itemSync.hasConflict()) {
        responder(
            "Antes de continuar, revise as alterações de sincronização pendentes."
        );
        return null;
    }

    if (
        !usuarioAtual
    ) {

        responder(
            "Você precisa estar conectado."
        );

        return null;
    }


    if (
        !titulo ||
        !titulo.trim()
    ) {

        return null;
    }


                                                         
                       
                                                         

    const tituloLimpo =
        titulo.trim();

    const dataLimpa =
        data || null;

    const horarioLimpo =
        horario || null;


                                                         
                            
                                                         

    const candidato = {
        titulo: tituloLimpo,
        tipo,
        data: dataLimpa,
        horario: horarioLimpo
    };

    const itemDuplicado =
        encontrarItemDuplicado(
            itens,
            candidato
        );


                                                         
                               
                                                         

    if (
        itemDuplicado
    ) {

        console.warn(
            "Item duplicado ignorado:",
            {
                titulo:
                    tituloLimpo,

                tipo,

                data:
                    dataLimpa,

                horario:
                    horarioLimpo
            }
        );


        return itemDuplicado;
    }


                                                         
                      
                                                         

    const item = {

        id:
            Date.now() +
            Math.floor(
                Math.random() *
                1000
            ),

        titulo:
            tituloLimpo,

        tipo,

        data:
            dataLimpa,

        horario:
            horarioLimpo,

        concluido:
            false
    };


    itens.push(
        item
    );


                                                         
             
                                                         

    salvarDados();


                                                         
                          
                                                         

    atualizarInterface();


    return item;
}


                                                         
                                         
                                                         

function executarAcaoIA(dados) {

    if (
        !dados ||
        typeof dados !==
        "object"
    ) {

        responder(
            "Não consegui entender a resposta da inteligência da LIA."
        );

        return;
    }


                                                         
                                
                                                         

    const resposta =
        dados.resposta ||
        "Como posso ajudar?";


                                                         
                                        
                                                         

    if (
        dados.requerConfirmacao ===
        true
    ) {

        responder(
            resposta
             
        );

        falar(
            resposta,
             dados.estadoEmocional
        );

        return;
    }


                                                         
                                            
                                                         

    if (
        dados.cancelarPendentes ===
        true
    ) {

        responder(
            resposta
        );

        falar(
            resposta,
            dados.estadoEmocional
        );

        return;
    }


                                                         
                              
                                                         

    const acoes =
        Array.isArray(
            dados.acoes
        )
            ? dados.acoes
            : [];

         console.log(
    "AÇÕES RECEBIDAS DA LIA:",
    acoes
);
                                                         
                        
                                                         

    if (
        acoes.length === 0
    ) {

        responder(
            resposta
        );

        falar(
            resposta,
        );

        return;
    }


                                                         
                              
                                                         

    voiceController.definirSupressao(true);

    acoes.forEach(
        acao => {

            if (
                !acao ||
                typeof acao !==
                    "object"
            ) {

                return;
            }


            switch (
                acao.acao
            ) {


                                                         
                           
                                                         

                case "conversar":

                    break;


                                                         
                               
                                                         

                case "criar_tarefa": {

                    if (
                        !acao.titulo
                    ) {

                        console.warn(
                            "Ação criar_tarefa sem título."
                        );

                        break;
                    }


                    criarItem(
                        acao.titulo,
                        "tarefa",
                        acao.data,
                        acao.horario
                    );


                    break;
                }


                                                         
                                      
                                                         

                case "agendar": {

                    if (
                        !acao.titulo
                    ) {

                        console.warn(
                            "Ação agendar sem título."
                        );

                        break;
                    }


                    criarItem(
                        acao.titulo,
                        "compromisso",
                        acao.data,
                        acao.horario
                    );


                    break;
                }


                                                         
                               
                                                         

                case "alterar": {

                    alterarItemIA(
                        {
                            ...acao,
                            resposta:
                                ""
                        }
                    );


                    break;
                }


                                                         
                               
                                                         

                case "excluir": {

                    excluirItemIA(
                        acao.titulo,
                        ""
                    );


                    break;
                }


                                                         
                                  
                                                         

                case "concluir": {

                    concluirItemIA(
                        acao.titulo,
                        ""
                    );


                    break;
                }


                                                         
                                    
                                                         

                case "consultar_tarefas": {

                    consultarTarefasIA();

                    break;
                }


                                                         
                                   
                                                         

                case "consultar_agenda": {

                    consultarAgendaIA(
                        acao.data
                    );

                    break;
                }


                                                         
                                    
                                                         

                default:

                    console.warn(
                        "Ação não reconhecida pela LIA:",
                        acao.acao
                    );
            }
        }
    );

    voiceController.definirSupressao(false);


                                                         
                                   
                                                         

    atualizarInterface();


                                                         
                                 
                                                         

    responder(
        resposta
    );


    falar(
        resposta
    );
}


                                                         
                   
                                                         

function alterarItemIA(dados) {

    if (itemSync.hasConflict()) {
        responder(
            "Antes de continuar, revise as alterações de sincronização pendentes."
        );
        return;
    }

    if (!dados.titulo) {

        responder(
            "Não consegui identificar o item que você deseja alterar."
        );

        return;
    }

    const item =
        encontrarItem(
            dados.titulo
        );

    if (!item) {

        responder(
            `Não encontrei "${dados.titulo}" nas suas tarefas ou agenda.`
        );

        return;
    }

    if (dados.novoTitulo) {

        item.titulo =
            dados.novoTitulo.trim();
    }

    if (dados.novaData) {

        item.data =
            dados.novaData;
    }

    if (dados.novoHorario) {

        item.horario =
            dados.novoHorario;
    }

    salvarDados();

    atualizarInterface();

    const resposta =
        dados.resposta ||
        `${item.titulo} foi alterado com sucesso.`;

    responder(resposta);

    falar(resposta);
}


                                                         
                   
                                                         

function excluirItemIA(
    titulo,
    respostaIA
) {

    if (itemSync.hasConflict()) {
        responder(
            "Antes de continuar, revise as alterações de sincronização pendentes."
        );
        return;
    }

    if (!titulo) {

        responder(
            "Não consegui identificar o item que você deseja excluir."
        );

        return;
    }

    const item =
        encontrarItem(titulo);

    if (!item) {

        responder(
            `Não encontrei "${titulo}".`
        );

        return;
    }

    itens =
        itens.filter(
            atual =>
                atual.id !==
                item.id
        );

    salvarDados();

    atualizarInterface();

    const resposta =
        respostaIA ||
        `${item.titulo} foi removido.`;

    responder(resposta);

    falar(resposta);
}


                                                         
                    
                                                         

function concluirItemIA(
    titulo,
    respostaIA
) {

    if (itemSync.hasConflict()) {
        responder(
            "Antes de continuar, revise as alterações de sincronização pendentes."
        );
        return;
    }

    if (!titulo) {

        responder(
            "Não consegui identificar qual tarefa você concluiu."
        );

        return;
    }

    const item =
        encontrarItem(titulo);

    if (!item) {

        responder(
            `Não encontrei "${titulo}".`
        );

        return;
    }

    item.concluido =
        true;

    salvarDados();

    atualizarInterface();

    const resposta =
        respostaIA ||
        `${item.titulo} foi marcada como concluída.`;

    responder(resposta);

    falar(resposta);
}


                                                         
                        
                                                         

function consultarTarefasIA() {

    const tarefas =
        itens.filter(
            item =>
                item.tipo ===
                    "tarefa" &&
                !item.concluido
        );

    if (
        tarefas.length === 0
    ) {

        const resposta =
            "Você não possui tarefas pendentes.";

        responder(resposta);

        falar(resposta);

        return;
    }

    const texto =
        tarefas
            .map(
                tarefa => {

                    let linha =
                        tarefa.titulo;

                    if (tarefa.data) {

                        linha +=
                            ` em ${formatarDataBrasileira(
                                tarefa.data
                            )}`;
                    }

                    if (
                        tarefa.horario
                    ) {

                        linha +=
                            ` às ${tarefa.horario}`;
                    }

                    return linha;
                }
            )
            .join(". ");

    const resposta =
        `Você possui as seguintes tarefas: ${texto}.`;

    responder(resposta);

    falar(resposta);
}


                                                         
                       
                                                         

function consultarAgendaIA(
    data
) {

    let agenda =
        itens.filter(
            item =>
                item.tipo ===
                "compromisso"
        );

    if (data) {

        agenda =
            agenda.filter(
                item =>
                    item.data ===
                    data
            );
    }

    agenda.sort(
        (a, b) => {

            const dataA =
                `${a.data || ""} ${a.horario || ""}`;

            const dataB =
                `${b.data || ""} ${b.horario || ""}`;

            return dataA.localeCompare(
                dataB
            );
        }
    );

    if (
        agenda.length === 0
    ) {

        const resposta =
            "Você não possui compromissos nesse período.";

        responder(resposta);

        falar(resposta);

        return;
    }

    const texto =
        agenda
            .map(
                item => {

                    let linha =
                        item.titulo;

                    if (item.data) {

                        linha +=
                            ` em ${formatarDataBrasileira(
                                item.data
                            )}`;
                    }

                    if (item.horario) {

                        linha +=
                            ` às ${item.horario}`;
                    }

                    return linha;
                }
            )
            .join(". ");

    const resposta =
        `Você tem: ${texto}.`;

    responder(resposta);

    falar(resposta);
}


async function conversarComIA(
    mensagem
) {

    if (itemSync.hasConflict()) {
        responder(
            "Antes de conversar com a LIA, revise as alterações de sincronização pendentes."
        );
        return;
    }

    if (!usuarioAtual) {

        mostrarAutenticacao();

        return;
    }

    try {

        responder(
            "Estou pensando..."
        );

        if (enviarMensagem) {

            enviarMensagem.disabled =
                true;
        }

        if (microfone) {

            microfone.disabled =
                true;
        }

        const respostaServidor =
            await fetch(
                "/api/lia",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials:
                        "same-origin",

                    body:
                        JSON.stringify({

                            mensagem,

                            dataAtual:
                                formatarDataISO(
                                    new Date()
                                )
                        })
                }
            );

        const dados =
            await respostaServidor.json();

          
                                     
                                 
          

        if (
            respostaServidor.status ===
            401
        ) {

            usuarioAtual =
                null;

            itens =
                [];

            mostrarAutenticacao();

            authUi.mostrarMensagemLogin(
                "Sua sessão expirou. Faça login novamente."
            );

            return;
        }

        if (
            !respostaServidor.ok
        ) {

            throw new Error(
                dados.erro ||
                "Não foi possível conversar com a LIA."
            );
        }

        console.log(
            "Resposta estruturada da IA:",
            dados
        );

        executarAcaoIA(dados);

    } catch (erro) {

        console.error(
            "Erro na comunicação com a LIA:",
            erro
        );

        responder(
            erro.message ||
            "Não consegui processar sua solicitação agora."
        );

    } finally {

        if (enviarMensagem) {

            enviarMensagem.disabled =
                false;
        }

        if (microfone) {

            microfone.disabled =
                false;
        }
    }
}


                                                         
                      
                                                         

async function enviarMensagemParaLia() {

    if (!mensagemLia) {
        return;
    }

    const mensagem =
        mensagemLia.value.trim();

    if (!mensagem) {
        return;
    }

    mensagemLia.value =
        "";

    await conversarComIA(
        mensagem
    );
}


                                                         
                
                                                         

function configurarMicrofone() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (
        !SpeechRecognition ||
        !microfone
    ) {

        if (microfone) {

            microfone.title =
                "Reconhecimento de voz não disponível neste navegador.";
        }

        return;
    }

    reconhecimento =
        new SpeechRecognition();

    reconhecimento.lang =
        "pt-BR";

    reconhecimento.continuous =
        false;

    reconhecimento.interimResults =
        false;


    microfone.addEventListener(
        "click",
        () => {

            if (!usuarioAtual) {
                return;
            }

            responder(
                "Estou ouvindo..."
            );

            try {

                reconhecimento.start();

            } catch (erro) {

                console.error(
                    "Erro ao iniciar microfone:",
                    erro
                );
            }
        }
    );


    reconhecimento.onresult =
        async evento => {

            const texto =
                evento
                    .results[0][0]
                    .transcript;

            console.log(
                "Você disse:",
                texto
            );

            if (mensagemLia) {

                mensagemLia.value =
                    texto;
            }

            await enviarMensagemParaLia();
        };


    reconhecimento.onerror =
        evento => {

            console.error(
                "Erro no reconhecimento de voz:",
                evento.error
            );

            responder(
                "Não consegui entender sua voz. Tente novamente."
            );
        };
}


                                                         
                        
                                                         

function atualizarInterface() {

    dashboard.render();
    tasksPageRenderer.render();
}


                                                         
                
                                                         

function desativarBotoesMenu() {

    const botoes =
        document.querySelectorAll(
            ".sidebar-menu .sidebar-link"
        );

    botoes.forEach(
        botao => {

            botao.classList.remove(
                "active"
            );
            botao.removeAttribute("aria-current");
        }
    );
}

function ativarBotaoMenu(botao) {

    desativarBotoesMenu();
    botao?.classList.add("active");
    botao?.setAttribute("aria-current", "page");

    if (window.matchMedia("(max-width: 650px)").matches) {
        window.scrollTo({
            top: 0,
            behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches ?
                "auto" :
                "smooth"
        });
    }
}


function abrirMeuDia() {

    if (meuDiaPage) {

        meuDiaPage.classList.remove(
            "hidden"
        );

        meuDiaPage.style.display =
            "block";
    }

    if (agendaPage) {

        agendaPage.classList.add(
            "hidden"
        );

        agendaPage.style.display =
            "none";
    }

    tarefasPage?.classList.add("hidden");
    objetivosPageElement?.classList.add("hidden");
    if (tarefasPage) {
        tarefasPage.style.display = "none";
    }
    if (objetivosPageElement) {
        objetivosPageElement.style.display = "none";
    }

    ativarBotaoMenu(btnMeuDia);
}


function abrirAgenda() {

    if (meuDiaPage) {

        meuDiaPage.classList.add(
            "hidden"
        );

        meuDiaPage.style.display =
            "none";
    }

    tarefasPage?.classList.add("hidden");
    objetivosPageElement?.classList.add("hidden");
    if (tarefasPage) {
        tarefasPage.style.display = "none";
    }
    if (objetivosPageElement) {
        objetivosPageElement.style.display = "none";
    }

    if (agendaPage) {

        agendaPage.classList.remove(
            "hidden"
        );

        agendaPage.style.display =
            "block";
    }

    ativarBotaoMenu(btnAgenda);
}

function abrirTarefas() {

    meuDiaPage?.classList.add("hidden");
    agendaPage?.classList.add("hidden");
    objetivosPageElement?.classList.add("hidden");

    if (meuDiaPage) {
        meuDiaPage.style.display = "none";
    }

    if (agendaPage) {
        agendaPage.style.display = "none";
    }
    if (objetivosPageElement) {
        objetivosPageElement.style.display = "none";
    }

    tarefasPage?.classList.remove("hidden");
    if (tarefasPage) {
        tarefasPage.style.display = "block";
    }

    ativarBotaoMenu(btnTarefas);
    tasksPageRenderer.render();
}

function abrirObjetivos() {

    meuDiaPage?.classList.add("hidden");
    agendaPage?.classList.add("hidden");
    tarefasPage?.classList.add("hidden");

    [meuDiaPage, agendaPage, tarefasPage].forEach(page => {
        if (page) {
            page.style.display = "none";
        }
    });

    objetivosPageElement?.classList.remove("hidden");
    if (objetivosPageElement) {
        objetivosPageElement.style.display = "block";
    }

    ativarBotaoMenu(btnObjetivos);
    objectivesPage.render();
}

function criarTarefaPelaPagina({ titulo, data, horario }) {

    if (!dadosServidorProntos) {
        return false;
    }

    if (data && !criarDataLocal(data)) {
        mostrarStatusSincronizacao(
            "A data informada para a tarefa é inválida.",
            true
        );
        return false;
    }

    const novaTarefa = criarItem(titulo, "tarefa", data, horario);
    return Boolean(novaTarefa);
}

function alternarConclusaoTarefa(id) {

    if (itemSync.hasConflict()) {
        responder(
            "Revise primeiro as alterações de sincronização pendentes."
        );
        return;
    }

    const tarefa = itens.find(item => (
        item.id === id &&
        item.tipo === "tarefa"
    ));

    if (!tarefa || !dadosServidorProntos) {
        return;
    }

    tarefa.concluido = !tarefa.concluido;
    salvarDados();
    atualizarInterface();
}

function excluirTarefaPelaPagina(id) {

    if (itemSync.hasConflict()) {
        responder(
            "Revise primeiro as alterações de sincronização pendentes."
        );
        return;
    }

    const tarefa = itens.find(item => (
        item.id === id &&
        item.tipo === "tarefa"
    ));

    if (!tarefa || !dadosServidorProntos) {
        return;
    }

    itens = itens.filter(item => item.id !== id);
    salvarDados();
    atualizarInterface();
}


                                                         
                                        
                                                         

async function enviarComandoRapido(
    texto
) {

    if (!usuarioAtual) {
        return;
    }

    if (mensagemLia) {

        mensagemLia.value =
            texto;
    }

    await enviarMensagemParaLia();
}


                                                         
                              
                                                         

function adicionarCompromissoManual() {

    const titulo =
        prompt(
            "Qual é o compromisso?"
        );

    if (!titulo) {
        return;
    }

    const data =
        prompt(
            "Digite a data no formato DD/MM/AAAA:"
        );

    const horario =
        prompt(
            "Digite o horário no formato HH:MM:"
        );

    let dataISO =
        null;

    if (data) {

        const partes =
            data.split("/");

        if (
            partes.length === 3
        ) {

            const dia =
                partes[0]
                    .padStart(
                        2,
                        "0"
                    );

            const mes =
                partes[1]
                    .padStart(
                        2,
                        "0"
                    );

            const ano =
                partes[2];

            dataISO =
                `${ano}-${mes}-${dia}`;
        }
    }

    criarItem(
        titulo,
        "compromisso",
        dataISO,
        horario || null
    );

    const resposta =
        `"${titulo}" foi adicionado à sua agenda.`;

    responder(resposta);

    falar(resposta);
}


const retryButtons = [
    document.getElementById("retrySync"),
    document.getElementById("taskRetrySync")
].filter(Boolean);

async function tentarNovamenteSincronizar() {

    retryButtons.forEach(button => {
        button.disabled = true;
    });

    if (itemSync.hasConflict()) {
        try {
            let conflito = itemSync.getConflict();

            if (!conflito?.server) {
                conflito = await itemSync.refreshConflict();
            }

            conflictReview.show(conflito);
        } catch (erro) {
            console.error(
                "Erro ao carregar a versão atual dos dados:",
                erro
            );

            mostrarStatusSincronizacao(
                `Não foi possível carregar a versão do servidor: ${erro.message}`,
                true,
                true,
                "Tentar carregar novamente"
            );
        } finally {
            retryButtons.forEach(button => {
                button.disabled = false;
            });
        }

        return;
    }

    if (dadosServidorProntos) {
        await itemSync.save();
        retryButtons.forEach(button => {
            button.disabled = false;
        });
        return;
    }

    try {
        itens = await carregarDados();
        definirDisponibilidadeDados(true);
        atualizarInterface();
        mostrarStatusSincronizacao("");
    } catch (erro) {
        console.error(
            "Erro ao tentar carregar os dados novamente:",
            erro
        );

        mostrarStatusSincronizacao(
            `Não foi possível carregar seus dados: ${erro.message}`,
            true,
            true
        );
    } finally {
        retryButtons.forEach(button => {
            button.disabled = false;
        });
    }
}

retryButtons.forEach(button => {
    button.addEventListener("click", tentarNovamenteSincronizar);
});

if (btnToggleVoz) {

    btnToggleVoz.addEventListener(
        "click",
        () => voiceController.alternarAtivacao()
    );
}


                                                         
                     
                                                         

if (enviarMensagem) {

    enviarMensagem.addEventListener(
        "click",
        enviarMensagemParaLia
    );
}


if (mensagemLia) {

    mensagemLia.addEventListener(
        "keydown",
        evento => {

            if (
                evento.key ===
                    "Enter" &&
                !evento.shiftKey
            ) {

                evento.preventDefault();

                enviarMensagemParaLia();
            }
        }
    );
}


                                                         
                           
                                                         

if (btnMeuDia) {

    btnMeuDia.addEventListener(
        "click",
        abrirMeuDia
    );
}


if (btnAgenda) {

    btnAgenda.addEventListener(
        "click",
        abrirAgenda
    );
}


if (verAgendaCompleta) {

    verAgendaCompleta.addEventListener(
        "click",
        abrirAgenda
    );
}


                                                         
                       
                                                         

if (novoCompromisso) {

    novoCompromisso.addEventListener(
        "click",
        adicionarCompromissoManual
    );
}


                                                         
                           
                                                         

if (atalhoCriarTarefa) {

    atalhoCriarTarefa.addEventListener(
        "click",
        () => {

            if (!mensagemLia) {
                return;
            }

            mensagemLia.value =
                "Crie uma tarefa para ";

            mensagemLia.focus();
        }
    );
}


if (atalhoAgendar) {

    atalhoAgendar.addEventListener(
        "click",
        () => {

            if (!mensagemLia) {
                return;
            }

            mensagemLia.value =
                "Agende um compromisso ";

            mensagemLia.focus();
        }
    );
}


if (atalhoOrganizarDia) {

    atalhoOrganizarDia.addEventListener(
        "click",
        () => {

            enviarComandoRapido(
                "Analise minhas tarefas e compromissos e me ajude a organizar meu dia de hoje."
            );
        }
    );
}


if (atalhoInsight) {

    atalhoInsight.addEventListener(
        "click",
        () => {

            enviarComandoRapido(
                "Com base nas minhas tarefas e compromissos, me dê um insight curto para melhorar minha organização hoje."
            );
        }
    );
}


                                                         
                                      
                                                         

function informarFuncaoEmDesenvolvimento(
    nome
) {

    responder(
        `${nome} será adicionada em uma próxima etapa da LIA.`
    );

    abrirMeuDia();
}


if (btnTarefas) {

    btnTarefas.addEventListener(
        "click",
        abrirTarefas
    );
}

if (verTodasTarefas) {
    verTodasTarefas.addEventListener("click", abrirTarefas);
}

if (voltarMeuDiaTarefas) {
    voltarMeuDiaTarefas.addEventListener("click", abrirMeuDia);
}

if (btnObjetivos) {
    btnObjetivos.addEventListener("click", abrirObjetivos);
}

if (verObjetivos) {
    verObjetivos.addEventListener("click", abrirObjetivos);
}

objectivesPage.setReturnHandler(abrirMeuDia);

if (btnNotas) {

    btnNotas.addEventListener(
        "click",
        () => {

            informarFuncaoEmDesenvolvimento(
                "A página de Notas"
            );
        }
    );
}


if (btnLiaAi) {

    btnLiaAi.addEventListener(
        "click",
        () => {

            abrirMeuDia();

            if (mensagemLia) {

                mensagemLia.focus();
            }
        }
    );
}


if (btnConfiguracoes) {

    btnConfiguracoes.addEventListener(
        "click",
        () => {

            informarFuncaoEmDesenvolvimento(
                "A página de Configurações"
            );
        }
    );
}


                                                         
                    
                                                         

async function iniciarLIA() {

    console.log(
        "Iniciando LIA..."
    );

      
                                        
                                      
      

    if (appPrincipal) {

        appPrincipal.classList.add(
            "hidden"
        );
    }

    authUi.bind();
    authUi.configurarBotoesSenha();

    configurarMicrofone();

    atualizarEstadoVozLia();

    atualizarDataCabecalho();

    await authUi.verificarSessao();

    console.log(
        "LIA iniciada."
    );
}


                                                         
              
                                                         

iniciarLIA();