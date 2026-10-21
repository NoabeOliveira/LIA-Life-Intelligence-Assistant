                                                         
                                    
            
                                                         

import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import session from "express-session";
import bcrypt from "bcryptjs";
import {
    createItemStore,
    ItemRevisionConflictError
} from "./modules/item-store.js";
import { createSqliteSessionStore } from "./modules/sqlite-session-store.js";
import { createSqliteUsageLimiter } from "./modules/sqlite-usage-limiter.js";
import { createObjectiveStore } from "./modules/objective-store.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const loginAttempts = new Map();
const REMEMBERED_SESSION_MAX_AGE_MS =
    1000 * 60 * 60 * 24 * 7;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_LOGIN_MS = 5 * 60 * 1000;

function getClientIdentifier(req) {

    return (
        req.ip ||
        req.headers["x-forwarded-for"] ||
        "unknown-client"
    );
}

function limparExpirados() {

    const agora = Date.now();

    for (const [chave, dados] of loginAttempts.entries()) {

        if (
            agora - dados.ultimoTempo >
            RATE_LIMIT_WINDOW_MS
        ) {

            loginAttempts.delete(chave);
        }
    }
}

function verificarRateLimit(req, res, next) {

    limparExpirados();

    const chave = getClientIdentifier(req);
    const agora = Date.now();
    const dadoAtual = loginAttempts.get(chave) || {
        contagem: 0,
        ultimoTempo: agora,
        bloqueadoAte: 0
    };

    if (dadoAtual.bloqueadoAte > agora) {

        const tempoRestante = Math.ceil(
            (dadoAtual.bloqueadoAte - agora) / 1000
        );

        return res.status(429).json({
            sucesso: false,
            erro: `Muitas tentativas. Tente novamente em ${tempoRestante} segundos.`
        });
    }

    if (
        agora - dadoAtual.ultimoTempo >
        RATE_LIMIT_WINDOW_MS
    ) {

        dadoAtual.contagem = 0;
        dadoAtual.ultimoTempo = agora;
    }

    loginAttempts.set(chave, dadoAtual);
    next();
}

function registrarFalhaLogin(req) {

    limparExpirados();

    const chave = getClientIdentifier(req);
    const agora = Date.now();
    const dadoAtual = loginAttempts.get(chave) || {
        contagem: 0,
        ultimoTempo: agora,
        bloqueadoAte: 0
    };

    dadoAtual.contagem += 1;
    dadoAtual.ultimoTempo = agora;

    if (dadoAtual.contagem >= MAX_LOGIN_ATTEMPTS) {

        dadoAtual.bloqueadoAte = agora + BLOCK_LOGIN_MS;
        dadoAtual.contagem = MAX_LOGIN_ATTEMPTS;
    }

    loginAttempts.set(chave, dadoAtual);
}

function registrarSucessoLogin(req) {

    const chave = getClientIdentifier(req);
    loginAttempts.delete(chave);
}


                                                         
                      
                                                         

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDirectory = path.join(__dirname, "data");
const usersFile =
    process.env.LIA_USERS_FILE ||
    path.join(dataDirectory, "users.json");
const databasePath =
    process.env.LIA_DATABASE_PATH ||
    path.join(dataDirectory, "lia.sqlite");


                                                         
                                    
                                                         

if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, {
        recursive: true
    });
}

if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(
        usersFile,
        JSON.stringify([], null, 2)
    );
}


                                                         
              
                                                         

app.use(express.json({
    limit: "1mb"
}));

app.use(
    express.urlencoded({
        extended: true
    })
);


                                                         
         
                                                         

const sessionStore =
    createSqliteSessionStore(databasePath);

app.use(
    session({
        secret: process.env.SESSION_SECRET,

        store: sessionStore,

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure:
                process.env.NODE_ENV === "production"
        }
    })
);


                                                         
            
                                                         

app.use("/data", (req, res) => {
    res.sendStatus(404);
});

app.use(
    express.static(__dirname)
);


                                                         
                              
                                                         

if (!process.env.OPENAI_API_KEY) {

    console.error("");
    console.error(
        "ERRO: OPENAI_API_KEY não encontrada no .env"
    );
    console.error("");

    process.exit(1);
}


if (!process.env.SESSION_SECRET) {

    console.error("");
    console.error(
        "ERRO: SESSION_SECRET não encontrada no .env"
    );
    console.error("");

    process.exit(1);
}


                                                         
         
                                                         

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const itemStore = createItemStore(
    databasePath
);
const objectiveStore = createObjectiveStore(
    databasePath
);
const usageLimiter = createSqliteUsageLimiter(
    databasePath
);
const IA_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const IA_GLOBAL_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const IA_CHAT_RATE_LIMIT = 20;
const IA_VOICE_RATE_LIMIT = 30;
const IA_GLOBAL_CHAT_DAILY_LIMIT = 100;
const IA_GLOBAL_VOICE_DAILY_LIMIT = 100;

function limitarUsoIA(rota, limite, limiteGlobalDiario) {

    return (req, res, next) => {

        try {

            const resultado = usageLimiter.consumeWithGlobal(
                req.session.usuario.id,
                rota,
                limite,
                IA_RATE_LIMIT_WINDOW_MS,
                limiteGlobalDiario,
                IA_GLOBAL_RATE_LIMIT_WINDOW_MS
            );

            res.setHeader(
                "RateLimit-Remaining",
                String(resultado.remaining)
            );

            if (!resultado.allowed) {
                res.setHeader(
                    "Retry-After",
                    String(resultado.retryAfterSeconds)
                );

                return res.status(429).json({
                    erro: resultado.scope === "global" ?
                        "O limite diário deste recurso foi atingido. Tente novamente amanhã." :
                        "Você atingiu seu limite temporário de uso. Tente novamente mais tarde."
                });
            }

            next();

        } catch (erro) {

            console.error(
                `Erro ao verificar limite da rota ${rota}:`,
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível verificar o limite de uso."
            });
        }
    };
}


                                                         
                     
                                                         

function carregarUsuarios() {

    try {

        const dados = fs.readFileSync(
            usersFile,
            "utf8"
        );

        const usuarios =
            JSON.parse(dados);

        return Array.isArray(usuarios)
            ? usuarios
            : [];

    } catch (erro) {

        console.error(
            "Erro ao carregar usuários:",
            erro
        );

        return [];
    }
}


function salvarUsuarios(usuarios) {

    fs.writeFileSync(
        usersFile,
        JSON.stringify(
            usuarios,
            null,
            2
        )
    );
}


function normalizarEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();
}


function gerarIdUsuario() {

    return (
        Date.now().toString() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );
}


                                                         
                      
                                                         

function exigirLogin(
    req,
    res,
    next
) {

    if (!req.session.usuario) {

        return res
            .status(401)
            .json({
                autenticado: false,
                erro:
                    "Você precisa estar conectado."
            });
    }

    next();
}

function regenerarSessao(req) {

    return new Promise((resolve, reject) => {

        req.session.regenerate(erro => {

            if (erro) {
                reject(erro);
                return;
            }

            resolve();
        });
    });
}

                                                         
                             
                                                         

function normalizarTextoConversa(texto) {

    return String(texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(/[.!?]+$/g, "")
        .trim();
}


                                                         
                                
                                                         

function ehConfirmacaoCurta(texto) {

    const mensagem =
        normalizarTextoConversa(
            texto
        );

    const confirmacoes = [
        "sim",
        "pode",
        "pode sim",
        "pode fazer",
        "pode agendar",
        "confirmo",
        "confirmado",
        "claro",
        "isso",
        "isso mesmo",
        "correto",
        "ok",
        "okay"
    ];

    return confirmacoes.includes(
        mensagem
    );
}


                                                         
                            
                                                         

function ehNegacaoCurta(texto) {

    const mensagem =
        normalizarTextoConversa(
            texto
        );

    const negacoes = [
        "nao",
        "não",
        "nao quero",
        "não quero",
        "cancela",
        "cancelar",
        "deixa pra la",
        "deixa para la",
        "esquece"
    ];

    return negacoes.includes(
        mensagem
    );
}


                                                         
                                  
                                                         

function adicionarHistoricoLia(
    req,
    papel,
    conteudo
) {

    if (
        !Array.isArray(
            req.session.liaConversa
        )
    ) {

        req.session.liaConversa =
            [];
    }


    req.session.liaConversa.push({
        papel,
        conteudo:
            String(conteudo || "")
                .trim(),
        data:
            new Date()
                .toISOString()
    });


      
                                    
                     

                                        
                        
      

    if (
        req.session.liaConversa.length >
        20
    ) {

        req.session.liaConversa =
            req.session
                .liaConversa
                .slice(-20);
    }
}


                                                         
                                 
                                                         

function descreverAcaoLia(acao) {

    if (!acao) {
        return "";
    }


    let texto =
        acao.titulo ||
        "Item";


    if (acao.data) {

        const partes =
            acao.data.split("-");

        if (
            partes.length === 3
        ) {

            texto +=
                ` em ${partes[2]}/${partes[1]}/${partes[0]}`;
        }

    }


    if (acao.horario) {

        texto +=
            ` às ${acao.horario}`;
    }


    return texto;
}


                                                         
                             
                                                         

function montarConfirmacaoLia(
    acoes
) {

    if (
        !Array.isArray(acoes) ||
        acoes.length === 0
    ) {

        return "Deseja confirmar essa ação?";
    }


    const descricoes =
        acoes.map(
            descreverAcaoLia
        );


    if (
        descricoes.length === 1
    ) {

        return (
            `Entendi. Deseja que eu confirme ${descricoes[0]}?`
        );
    }


    return (
        `Entendi. Deseja que eu confirme estes ${descricoes.length} itens: ` +
        descricoes.join("; ") +
        "?"
    );
}


                                                         
                               
                                                         

function montarRespostaConfirmadaLia(
    acoes
) {

    if (
        !Array.isArray(acoes) ||
        acoes.length === 0
    ) {

        return "Pronto.";
    }


    if (acoes.length === 1) {

        return (
            `Pronto. ${descreverAcaoLia(
                acoes[0]
            )} foi confirmado.`
        );
    }


    return (
        `Pronto. Confirmei os ${acoes.length} itens para você.`
    );
}

                                                         
                            
                                                         

const caminhoMemorias =
    path.join(
        __dirname,
        "data",
        "memorias.json"
    );


                                                         
                               
                                                         

function garantirArquivoMemorias() {

    const pastaData =
        path.dirname(
            caminhoMemorias
        );


    if (
        !fs.existsSync(
            pastaData
        )
    ) {

        fs.mkdirSync(
            pastaData,
            {
                recursive: true
            }
        );
    }


    if (
        !fs.existsSync(
            caminhoMemorias
        )
    ) {

        fs.writeFileSync(
            caminhoMemorias,
            JSON.stringify(
                {},
                null,
                2
            ),
            "utf8"
        );
    }
}


                                                         
                             
                                                         

function carregarMemorias() {

    garantirArquivoMemorias();


    try {

        const conteudo =
            fs.readFileSync(
                caminhoMemorias,
                "utf8"
            );


        if (
            !conteudo.trim()
        ) {

            return {};
        }


        const memorias =
            JSON.parse(
                conteudo
            );


        if (
            !memorias ||
            typeof memorias !==
                "object" ||
            Array.isArray(
                memorias
            )
        ) {

            return {};
        }


        return memorias;


    } catch (erro) {

        console.error(
            "Erro ao carregar memórias da LIA:",
            erro
        );


        return {};
    }
}


                                                         
                           
                                                         

function salvarMemorias(
    memorias
) {

    garantirArquivoMemorias();


    fs.writeFileSync(
        caminhoMemorias,
        JSON.stringify(
            memorias,
            null,
            2
        ),
        "utf8"
    );
}


                                                         
                            
                                                         

function obterMemoriasUsuario(
    usuarioId
) {

    const memorias =
        carregarMemorias();


    const chaveUsuario =
        String(
            usuarioId
        );


    if (
        !Array.isArray(
            memorias[
                chaveUsuario
            ]
        )
    ) {

        return [];
    }


    return memorias[
        chaveUsuario
    ];
}

                                                         
                                 
                                                         

function selecionarMemoriasRelevantes(
    memorias,
    mensagemAtual,
    limite = 8
) {

    if (
        !Array.isArray(memorias) ||
        memorias.length === 0
    ) {

        return [];
    }


    const mensagemNormalizada =
        normalizarTextoConversa(
            mensagemAtual || ""
        );


    const palavrasMensagem =
        mensagemNormalizada
            .split(/\s+/)
            .filter(
                palavra =>
                    palavra.length >= 3
            );


                                                         
                                         
                                                         

    const pedidoPlanejamento =
        [
            "organize meu dia",
            "organizar meu dia",
            "planeje meu dia",
            "planejar meu dia",
            "monte meu dia",
            "minha rotina",
            "organize minha rotina",
            "planeje minha rotina",
            "organize minha semana",
            "planeje minha semana",
            "o que devo fazer",
            "como organizar"
        ].some(
            termo =>
                mensagemNormalizada.includes(
                    normalizarTextoConversa(
                        termo
                    )
                )
        );


                                                         
                          
                                                         

    const memoriasPontuadas =
        memorias.map(
            memoria => {

                const conteudo =
                    normalizarTextoConversa(
                        memoria.conteudo ||
                        ""
                    );


                const categoria =
                    normalizarTextoConversa(
                        memoria.categoria ||
                        "geral"
                    );


                let pontuacao =
                    0;


                                                         
                                    
                                                         

                for (
                    const palavra of
                    palavrasMensagem
                ) {

                    if (
                        conteudo.includes(
                            palavra
                        )
                    ) {

                        pontuacao +=
                            3;
                    }
                }


                                                         
                               
                                                         

                if (
                    pedidoPlanejamento
                ) {

                    if (
                        [
                            "preferencia",
                            "rotina",
                            "estudo",
                            "trabalho",
                            "pessoal"
                        ].includes(
                            categoria
                        )
                    ) {

                        pontuacao +=
                            4;
                    }


                    if (
                        conteudo.includes(
                            "horario"
                        ) ||
                        conteudo.includes(
                            "manha"
                        ) ||
                        conteudo.includes(
                            "tarde"
                        ) ||
                        conteudo.includes(
                            "noite"
                        ) ||
                        conteudo.includes(
                            "faculdade"
                        ) ||
                        conteudo.includes(
                            "trabalho"
                        ) ||
                        conteudo.includes(
                            "estudar"
                        ) ||
                        conteudo.includes(
                            "academia"
                        )
                    ) {

                        pontuacao +=
                            4;
                    }
                }


                return {

                    memoria,

                    pontuacao
                };
            }
        );


                                                         
                        
                                                         

    const relevantes =
        memoriasPontuadas
            .filter(
                item =>
                    item.pontuacao > 0
            )
            .sort(
                (a, b) =>
                    b.pontuacao -
                    a.pontuacao
            )
            .slice(
                0,
                limite
            )
            .map(
                item =>
                    item.memoria
            );


                                                         
                                 
                                                         

      
                                        
                                          
                                       
                                       
                                
      

    if (
        pedidoPlanejamento &&
        relevantes.length === 0
    ) {

        return memorias
            .filter(
                memoria => {

                    const categoria =
                        normalizarTextoConversa(
                            memoria.categoria ||
                            "geral"
                        );


                    return [
                        "preferencia",
                        "rotina",
                        "estudo",
                        "trabalho",
                        "pessoal"
                    ].includes(
                        categoria
                    );
                }
            )
            .slice(
                0,
                limite
            );
    }


    return relevantes;
}


                                                         
                    
                                                         

function adicionarMemoriaUsuario(
    usuarioId,
    conteudo,
    categoria = "geral"
) {

    if (
        !conteudo ||
        !String(
            conteudo
        ).trim()
    ) {

        return null;
    }


    const memorias =
        carregarMemorias();


    const chaveUsuario =
        String(
            usuarioId
        );


    if (
        !Array.isArray(
            memorias[
                chaveUsuario
            ]
        )
    ) {

        memorias[
            chaveUsuario
        ] = [];
    }


    const conteudoLimpo =
        String(
            conteudo
        ).trim();


                                                         
                               
                                                         

    const memoriaExistente =
        memorias[
            chaveUsuario
        ].find(
            memoria =>
                String(
                    memoria.conteudo ||
                    ""
                )
                    .trim()
                    .toLowerCase() ===
                conteudoLimpo
                    .toLowerCase()
        );


    if (
        memoriaExistente
    ) {

        return memoriaExistente;
    }


    const novaMemoria = {

        id:
            `mem_${Date.now()}_${Math.floor(
                Math.random() *
                100000
            )}`,

        conteudo:
            conteudoLimpo,

        categoria:
            categoria ||
            "geral",

        criadaEm:
            new Date()
                .toISOString()
    };


    memorias[
        chaveUsuario
    ].push(
        novaMemoria
    );


    salvarMemorias(
        memorias
    );


    return novaMemoria;
}

                                                         
                    
                                                         

function atualizarMemoriaUsuario(
    usuarioId,
    memoriaId,
    novoConteudo,
    novaCategoria = null
) {

    if (
        !memoriaId ||
        !novoConteudo ||
        !String(
            novoConteudo
        ).trim()
    ) {

        return null;
    }


    const memorias =
        carregarMemorias();


    const chaveUsuario =
        String(
            usuarioId
        );


    if (
        !Array.isArray(
            memorias[
                chaveUsuario
            ]
        )
    ) {

        return null;
    }


    const indiceMemoria =
        memorias[
            chaveUsuario
        ].findIndex(
            memoria =>
                memoria.id ===
                memoriaId
        );


    if (
        indiceMemoria === -1
    ) {

        return null;
    }


    const memoriaAtual =
        memorias[
            chaveUsuario
        ][
            indiceMemoria
        ];


    const memoriaAtualizada = {

        ...memoriaAtual,

        conteudo:
            String(
                novoConteudo
            ).trim(),

        categoria:
            novaCategoria ||
            memoriaAtual.categoria ||
            "geral",

        atualizadaEm:
            new Date()
                .toISOString()
    };


    memorias[
        chaveUsuario
    ][
        indiceMemoria
    ] =
        memoriaAtualizada;


    salvarMemorias(
        memorias
    );


    return memoriaAtualizada;
}


                                                         
                  
                                                         

function excluirMemoriaUsuario(
    usuarioId,
    memoriaId
) {

    const memorias =
        carregarMemorias();


    const chaveUsuario =
        String(
            usuarioId
        );


    if (
        !Array.isArray(
            memorias[
                chaveUsuario
            ]
        )
    ) {

        return false;
    }


    const quantidadeAnterior =
        memorias[
            chaveUsuario
        ].length;


    memorias[
        chaveUsuario
    ] =
        memorias[
            chaveUsuario
        ].filter(
            memoria =>
                memoria.id !==
                memoriaId
        );


    const excluiu =
        memorias[
            chaveUsuario
        ].length <
        quantidadeAnterior;


    if (
        excluiu
    ) {

        salvarMemorias(
            memorias
        );
    }


    return excluiu;
}

                                                         
        
                                                         

app.get(
    "/api/teste",
    (req, res) => {

        res.json({
            status: "ok",
            mensagem:
                "Servidor da LIA funcionando!"
        });

    }
);

                                                         
                   
                                                         

app.get(
    "/api/itens",
    exigirLogin,
    (req, res) => {

        try {

            return res.json({
                itens: itemStore.list(
                    req.session.usuario.id
                ),
                revision: itemStore.getRevision(
                    req.session.usuario.id
                )
            });

        } catch (erro) {

            console.error(
                "Erro ao carregar itens do usuário:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível carregar seus itens."
            });
        }
    }
);

app.put(
    "/api/itens",
    exigirLogin,
    (req, res) => {

        try {

            const revision = req.body?.revision;

            if (
                !Number.isSafeInteger(revision) ||
                revision < 0
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "A versão dos dados está ausente ou inválida. Recarregue seus itens."
                });
            }

            const resultado =
                itemStore.replace(
                    req.session.usuario.id,
                    req.body?.itens,
                    revision
                );

            return res.json({
                sucesso: true,
                itens: resultado.itens,
                revision: resultado.revision
            });

        } catch (erro) {

            if (erro instanceof ItemRevisionConflictError) {
                return res.status(409).json({
                    sucesso: false,
                    conflito: true,
                    revision: itemStore.getRevision(
                        req.session.usuario.id
                    ),
                    erro: "Seus dados foram alterados em outra sessão."
                });
            }

            if (
                erro instanceof TypeError ||
                erro instanceof RangeError
            ) {

                return res.status(400).json({
                    sucesso: false,
                    erro: erro.message
                });
            }

            console.error(
                "Erro ao salvar itens do usuário:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível salvar seus itens."
            });
        }
    }
);

                                                         
                       
                                                         

app.get(
    "/api/objetivos",
    exigirLogin,
    (req, res) => {

        try {
            return res.json({
                objetivos: objectiveStore.list(
                    req.session.usuario.id
                )
            });
        } catch (erro) {
            console.error(
                "Erro ao carregar objetivos do usuário:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível carregar seus objetivos."
            });
        }
    }
);

app.post(
    "/api/objetivos",
    exigirLogin,
    (req, res) => {

        try {
            const objetivo = objectiveStore.create(
                req.session.usuario.id,
                req.body
            );

            return res.status(201).json({
                sucesso: true,
                objetivo
            });
        } catch (erro) {
            if (
                erro instanceof TypeError ||
                erro instanceof RangeError
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: erro.message
                });
            }

            console.error(
                "Erro ao criar objetivo do usuário:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível criar o objetivo."
            });
        }
    }
);

app.post(
    "/api/objetivos/:objectiveId/etapas",
    exigirLogin,
    (req, res) => {

        try {
            const objetivo = objectiveStore.addMilestone(
                req.session.usuario.id,
                req.params.objectiveId,
                req.body?.titulo
            );

            if (!objetivo) {
                return res.status(404).json({
                    erro: "Objetivo não encontrado."
                });
            }

            return res.status(201).json({
                sucesso: true,
                objetivo
            });
        } catch (erro) {
            if (
                erro instanceof TypeError ||
                erro instanceof RangeError
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: erro.message
                });
            }

            console.error(
                "Erro ao adicionar etapa ao objetivo:",
                erro
            );

            return res.status(500).json({
                sucesso: false,
                erro: "Não foi possível adicionar a etapa."
            });
        }
    }
);

app.patch(
    "/api/objetivos/:objectiveId/etapas/:milestoneId",
    exigirLogin,
    (req, res) => {

        try {
            const objetivo = objectiveStore.setMilestoneCompleted(
                req.session.usuario.id,
                req.params.objectiveId,
                req.params.milestoneId,
                req.body?.concluida
            );

            if (!objetivo) {
                return res.status(404).json({
                    erro: "Objetivo ou etapa não encontrado."
                });
            }

            return res.json({
                sucesso: true,
                objetivo
            });
        } catch (erro) {
            if (erro instanceof TypeError) {
                return res.status(400).json({
                    erro: erro.message
                });
            }

            console.error(
                "Erro ao atualizar etapa do objetivo:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível atualizar a etapa."
            });
        }
    }
);

app.delete(
    "/api/objetivos/:objectiveId/etapas/:milestoneId",
    exigirLogin,
    (req, res) => {

        try {
            const objetivo = objectiveStore.deleteMilestone(
                req.session.usuario.id,
                req.params.objectiveId,
                req.params.milestoneId
            );

            if (!objetivo) {
                return res.status(404).json({
                    erro: "Objetivo ou etapa não encontrado."
                });
            }

            return res.json({
                sucesso: true,
                objetivo
            });
        } catch (erro) {
            if (erro instanceof RangeError) {
                return res.status(400).json({
                    erro: erro.message
                });
            }

            console.error(
                "Erro ao remover etapa do objetivo:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível remover a etapa."
            });
        }
    }
);

app.delete(
    "/api/objetivos/:objectiveId",
    exigirLogin,
    (req, res) => {

        try {
            const removido = objectiveStore.delete(
                req.session.usuario.id,
                req.params.objectiveId
            );

            if (!removido) {
                return res.status(404).json({
                    erro: "Objetivo não encontrado."
                });
            }

            return res.json({ sucesso: true });
        } catch (erro) {
            console.error(
                "Erro ao remover objetivo do usuário:",
                erro
            );

            return res.status(500).json({
                erro: "Não foi possível remover o objetivo."
            });
        }
    }
);


                                                         
           
                                                         

app.post(
    "/api/auth/cadastro",
    verificarRateLimit,
    async (req, res) => {

        try {

            const {
                nome,
                email,
                senha,
                confirmarSenha
            } = req.body;


                                                         
                   
                                                         

            if (
                !nome ||
                nome.trim().length < 2
            ) {

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        erro:
                            "Digite um nome válido."
                    });
            }


                                                         
                     
                                                         

            const emailNormalizado =
                normalizarEmail(email);


            if (
                !emailNormalizado ||
                !emailNormalizado.includes("@")
            ) {

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        erro:
                            "Digite um e-mail válido."
                    });
            }


                                                         
                    
                                                         

            if (
                !senha ||
                senha.length < 6
            ) {

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        erro:
                            "A senha deve possuir pelo menos 6 caracteres."
                    });
            }


                                                         
                              
                                                         

            if (
                senha !== confirmarSenha
            ) {

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        erro:
                            "As senhas não são iguais."
                    });
            }


                                                         
                                  
                                                         

            const usuarios =
                carregarUsuarios();


            const usuarioExistente =
                usuarios.find(
                    usuario =>
                        normalizarEmail(
                            usuario.email
                        ) ===
                        emailNormalizado
                );


            if (usuarioExistente) {

                registrarFalhaLogin(req);

                return res
                    .status(409)
                    .json({
                        sucesso: false,
                        erro:
                            "Já existe uma conta com esse e-mail."
                    });
            }


                                                         
                            
                                                         

            const senhaHash =
                await bcrypt.hash(
                    senha,
                    12
                );


                                                         
                           
                                                         

            const novoUsuario = {

                id: gerarIdUsuario(),

                nome:
                    nome.trim(),

                email:
                    emailNormalizado,

                senha:
                    senhaHash,

                criadoEm:
                    new Date()
                        .toISOString()

            };


            usuarios.push(
                novoUsuario
            );


            salvarUsuarios(
                usuarios
            );


                                                         
                                         
                                                         

            await regenerarSessao(req);
            registrarSucessoLogin(req);

            req.session.usuario = {

                id:
                    novoUsuario.id,

                nome:
                    novoUsuario.nome,

                email:
                    novoUsuario.email

            };

                                                                     
                              
                                                         

req.session.liaConversa =
    [];

req.session.liaAcoesPendentes =
    [];


            console.log("");
            console.log(
                "Usuário cadastrado:",
                novoUsuario.email
            );


            return res
                .status(201)
                .json({

                    sucesso: true,

                    mensagem:
                        "Conta criada com sucesso.",

                    usuario: {

                        id:
                            novoUsuario.id,

                        nome:
                            novoUsuario.nome,

                        email:
                            novoUsuario.email

                    }

                });


        } catch (erro) {

            console.error(
                "Erro no cadastro:",
                erro
            );


            return res
                .status(500)
                .json({
                    sucesso: false,
                    erro:
                        "Não foi possível criar a conta."
                });
        }

    }
);


                                                         
        
                                                         

app.post(
    "/api/auth/login",
    verificarRateLimit,
    async (req, res) => {

        try {

            const {
                email,
                senha,
                lembrarLogin
            } = req.body;


            const emailNormalizado =
                normalizarEmail(email);


            if (
                !emailNormalizado ||
                !senha
            ) {

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        erro:
                            "Informe seu e-mail e sua senha."
                    });
            }


            const usuarios =
                carregarUsuarios();


            const usuario =
                usuarios.find(
                    usuario =>
                        normalizarEmail(
                            usuario.email
                        ) ===
                        emailNormalizado
                );


            if (!usuario) {

                registrarFalhaLogin(req);

                return res
                    .status(401)
                    .json({
                        sucesso: false,
                        erro:
                            "E-mail ou senha incorretos."
                    });
            }


            const senhaCorreta =
                await bcrypt.compare(
                    senha,
                    usuario.senha
                );


            if (!senhaCorreta) {

                registrarFalhaLogin(req);

                return res
                    .status(401)
                    .json({
                        sucesso: false,
                        erro:
                            "E-mail ou senha incorretos."
                    });
            }

            registrarSucessoLogin(req);

            await regenerarSessao(req);

            req.session.usuario = {

                id:
                    usuario.id,

                nome:
                    usuario.nome,

                email:
                    usuario.email

            };

            req.session.cookie.maxAge =
                lembrarLogin === true ?
                    REMEMBERED_SESSION_MAX_AGE_MS :
                    null;

                                                                     
                              
                                                         

req.session.liaConversa =
    [];

req.session.liaAcoesPendentes =
    [];


            console.log("");
            console.log(
                "Usuário conectado:",
                usuario.email
            );


            return res.json({

                sucesso: true,

                mensagem:
                    "Login realizado com sucesso.",

                usuario: {

                    id:
                        usuario.id,

                    nome:
                        usuario.nome,

                    email:
                        usuario.email

                }

            });


        } catch (erro) {

            console.error(
                "Erro no login:",
                erro
            );


            return res
                .status(500)
                .json({
                    sucesso: false,
                    erro:
                        "Não foi possível realizar o login."
                });
        }

    }
);


                                                         
                           
                                                         

app.get(
    "/api/auth/me",
    (req, res) => {

        if (!req.session.usuario) {

            return res
                .status(401)
                .json({
                    autenticado: false
                });
        }


        return res.json({

            autenticado: true,

            usuario:
                req.session.usuario

        });

    }
);


                                                         
         
                                                         

app.post(
    "/api/auth/logout",
    (req, res) => {

        if (!req.session.usuario) {

            return res.json({
                sucesso: true,
                mensagem:
                    "Nenhuma sessão ativa."
            });
        }


        req.session.destroy(
            erro => {

                if (erro) {

                    return res
                        .status(500)
                        .json({
                            sucesso: false,
                            erro:
                                "Não foi possível sair."
                        });
                }


                res.clearCookie(
                    "connect.sid"
                );


                return res.json({

                    sucesso: true,

                    mensagem:
                        "Logout realizado com sucesso."

                });
            }
        );

    }
);


                                                         
         
                                                         

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            servidor: true,

            openaiConfigurada:
                Boolean(
                    process.env.OPENAI_API_KEY
                ),

            usuarioAutenticado:
                Boolean(
                    req.session.usuario
                ),

            mensagem:
                "LIA online."

        });

    }
);


                                                         
                        
                                                         

app.post(
    "/api/lia",

    exigirLogin,
    limitarUsoIA(
        "chat",
        IA_CHAT_RATE_LIMIT,
        IA_GLOBAL_CHAT_DAILY_LIMIT
    ),

    async (req, res) => {

        try {

            const {
                mensagem,
                dataAtual
            } = req.body;


                                                                 
                               
                                                                 

            if (
                !mensagem ||
                typeof mensagem !== "string" ||
                !mensagem.trim()
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Nenhuma mensagem válida foi enviada."
                    });
            }


            const mensagemAtual =
                mensagem.trim();

            if (mensagemAtual.length > 4000) {
                return res.status(400).json({
                    erro: "A mensagem deve ter no máximo 4.000 caracteres."
                });
            }


                                                                 
                                         
                                                                 

            if (
                !Array.isArray(
                    req.session.liaConversa
                )
            ) {

                req.session.liaConversa =
                    [];
            }


            if (
                !Array.isArray(
                    req.session.liaAcoesPendentes
                )
            ) {

                req.session.liaAcoesPendentes =
                    [];
            }


            const acoesPendentes =
                req.session
                    .liaAcoesPendentes;


            console.log("");

            console.log(
                `Mensagem de ${req.session.usuario.nome}:`,
                mensagemAtual
            );


            console.log(
                "Ações pendentes:",
                acoesPendentes.length
            );


                                                                 
                                        
                                                                 

            if (
                acoesPendentes.length > 0 &&
                ehConfirmacaoCurta(
                    mensagemAtual
                )
            ) {

                adicionarHistoricoLia(
                    req,
                    "usuario",
                    mensagemAtual
                );


                const acoesConfirmadas =
                    structuredClone(
                        acoesPendentes
                    );


                req.session
                    .liaAcoesPendentes =
                    [];


                const resposta =
                    montarRespostaConfirmadaLia(
                        acoesConfirmadas
                    );


                adicionarHistoricoLia(
                    req,
                    "lia",
                    resposta
                );


                console.log(
                    "Ações confirmadas:",
                    acoesConfirmadas.length
                );


                return res.json({

                    resposta,

                    requerConfirmacao:
                        false,

                    cancelarPendentes:
                        false,

                    acoes:
                        acoesConfirmadas
                });
            }


                                                                 
                                       
                                                                 

            if (
                acoesPendentes.length > 0 &&
                ehNegacaoCurta(
                    mensagemAtual
                )
            ) {

                adicionarHistoricoLia(
                    req,
                    "usuario",
                    mensagemAtual
                );


                req.session
                    .liaAcoesPendentes =
                    [];


                const resposta =
                    "Tudo bem. Não vou realizar essas ações.";


                adicionarHistoricoLia(
                    req,
                    "lia",
                    resposta
                );


                console.log(
                    "Ações pendentes canceladas."
                );


                return res.json({

                    resposta,

                    requerConfirmacao:
                        false,

                    cancelarPendentes:
                        true,

                    acoes:
                        []
                });
            }


                                                                 
                              
                                                                 
             
             const memoriasPermanentes =
    obterMemoriasUsuario(
        req.session
            .usuario
            .id
    );


    const memoriasRelevantes =
    selecionarMemoriasRelevantes(
        memoriasPermanentes,
        mensagemAtual
    );

            const contexto = {

                dataAtual:
                    dataAtual || null,

                usuario: {

                    nome:
                        req.session
                            .usuario
                            .nome
                },

                itens:
                    itemStore.list(
                        req.session.usuario.id
                    ),

                historicoConversa:
                    req.session
                        .liaConversa,

                acoesPendentes:
                    acoesPendentes,

                 memoriasPermanentes:
                       memoriasPermanentes,

                memoriasRelevantes:
                    memoriasRelevantes
            }; 

const inicioIA = performance.now();

const response =
    await openai.responses.create({

        model: "gpt-5.6-luna",

        reasoning: {
            effort: "low"
        },

        instructions: `
Você é LIA, Life Intelligence Assistant.

Você é uma assistente pessoal inteligente,
natural, organizada e contextual.

Responda sempre em português do Brasil.

A execução real das ações é feita pelo sistema.
Você interpreta o pedido e devolve dados estruturados.


======================================================
MEMÓRIA DE CONVERSA
======================================================

Você recebe:

- historicoConversa
- acoesPendentes
- itens já cadastrados
- mensagem atual do usuário

Use o histórico para manter a continuidade
da conversa.

Nunca trate automaticamente cada mensagem
como uma conversa nova.

Frases como:

"sim"
"não"
"isso"
"pode fazer"
"muda para 17:00"
"o segundo"
"só os dois primeiros"
"cancela a faculdade"
"e amanhã?"
"na verdade às 18:00"

podem depender da conversa anterior.


======================================================
AÇÕES DISPONÍVEIS
======================================================

conversar
criar_tarefa
agendar
alterar
excluir
concluir
consultar_tarefas
consultar_agenda


======================================================
TAREFAS E COMPROMISSOS
======================================================

Tarefa:
algo que o usuário precisa realizar.

Exemplos:

Estudar Java
Fazer trabalho
Comprar material
Revisar prova


Compromisso:
evento com horário ou presença prevista.

Exemplos:

Academia
Faculdade
Consulta
Reunião
Entrevista
Aula
Encontro


======================================================
MÚLTIPLAS AÇÕES
======================================================

Uma única mensagem pode gerar várias ações.

Exemplo:

"terça quero estudar Java às 09:00,
academia às 16:30 e faculdade às 18:50"

deve produzir três ações separadas.

Exemplo conceitual:

Estudar Java
acao = criar_tarefa

Academia
acao = agendar

Ir para faculdade
acao = agendar


======================================================
CONFIRMAÇÃO DE MÚLTIPLAS AÇÕES
======================================================

Quando o usuário solicitar DUAS OU MAIS
ações de criação ou agendamento na mesma
mensagem:

requerConfirmacao = true

Coloque TODAS as ações propostas
dentro de "acoes".

Não diga que elas já foram executadas.

Pergunte naturalmente se o usuário
deseja confirmar.

Exemplo:

"Entendi. Deseja que eu adicione esses
três itens?"


======================================================
CORREÇÕES ANTES DA CONFIRMAÇÃO
======================================================

Quando existirem acoesPendentes e o usuário
corrigir uma delas, mantenha as demais.

Exemplo:

Ações pendentes:

Estudar Java às 09:00
Academia às 16:30
Faculdade às 18:50

Usuário:

"Na verdade academia às 17:00."

Resultado esperado:

Estudar Java às 09:00
Academia às 17:00
Faculdade às 18:50

requerConfirmacao = true

Todas as ações que permanecerem pendentes
devem voltar no array "acoes".


======================================================
AÇÕES ÚNICAS
======================================================

Uma ordem clara para apenas uma ação
pode ser executada sem nova confirmação.

Exemplo:

"Agende dentista amanhã às 14:00"

requerConfirmacao = false


======================================================
CONSULTAS
======================================================

consultar_tarefas e consultar_agenda
não precisam de confirmação.

======================================================
PLANEJAMENTO DO DIA E DA SEMANA
======================================================

Quando o usuário pedir para:

"organizar meu dia"
"planejar meu dia"
"organizar meu dia de amanhã"
"planejar meu dia de amanhã"
"organizar minha rotina"
"planejar minha rotina"
"organizar minha semana"
"planejar minha semana"
"como devo organizar meu dia"
"o que devo fazer amanhã"

não responda apenas dizendo que irá consultar
tarefas ou compromissos.

Você já recebe no contexto:

- itens
- memoriasRelevantes
- memoriasPermanentes
- dataAtual

Use diretamente essas informações para construir
o planejamento na mesma resposta.


======================================================
USO DOS ITENS NO PLANEJAMENTO
======================================================

Analise os itens cadastrados e considere somente
aqueles relacionados ao período solicitado.

Respeite:

- tarefas existentes;
- compromissos existentes;
- datas;
- horários;
- conflitos de horário;
- atividades concluídas ou pendentes, quando essa
  informação estiver disponível.

Compromissos com horário definido devem ser tratados
como pontos fixos do planejamento.

Tarefas podem ser distribuídas nos períodos livres
quando isso for apropriado.


======================================================
USO DAS MEMÓRIAS NO PLANEJAMENTO
======================================================

Use "memoriasRelevantes" para personalizar o plano.

Considere naturalmente informações como:

- preferências de horário;
- rotina;
- horários de estudo;
- faculdade;
- trabalho;
- academia;
- hábitos explicitamente armazenados;
- outras preferências realmente relacionadas
  ao planejamento.

Não use uma memória irrelevante apenas porque
ela está armazenada.

Exemplo:

Se existir:

"Prefere estudar Java à noite."

e o usuário pedir:

"Organize meu dia de amanhã."

considere preferencialmente o período da noite
para estudar Java, desde que não exista conflito
com outro compromisso.


Se existir:

"Faculdade começa às 18:50."

considere esse horário ao organizar atividades
próximas desse período.


Se existir:

"Minha cor favorita é azul."

essa memória normalmente não possui relação com
a organização do dia e deve ser ignorada.


======================================================
NÃO CRIAR AÇÕES SEM PEDIDO
======================================================

Organizar ou planejar o dia não significa
automaticamente cadastrar novas tarefas ou
compromissos.

Se o usuário pedir apenas um planejamento:

acoes = []

requerConfirmacao = false

cancelarPendentes = false

Apresente o planejamento na propriedade "resposta".

Somente gere ações de criação ou agendamento
quando o usuário pedir explicitamente para
adicionar, criar, marcar ou agendar algo.


======================================================
RESPOSTA DO PLANEJAMENTO
======================================================

Entregue o planejamento diretamente.

Não responda apenas:

"Vou consultar sua agenda."

"Vou verificar suas tarefas."

"Vou organizar seu dia."

"Vou consultar seus compromissos."

Em vez disso, faça a análise e apresente o resultado
na própria resposta.

Se não houver itens cadastrados para o período,
informe isso naturalmente e ainda assim ofereça
uma organização útil quando houver contexto
suficiente nas memoriasRelevantes.

Nunca invente compromissos, tarefas, horários
ou preferências que não estejam no contexto.


======================================================
CONVERSA NORMAL
======================================================

Quando não houver nenhuma ação para
o sistema executar:

acoes = []

requerConfirmacao = false

cancelarPendentes = false


======================================================
DATAS
======================================================

Use dataAtual como referência.

Converta datas para:

YYYY-MM-DD

Interprete expressões como:

hoje
amanhã
terça-feira
quarta-feira
próxima segunda-feira

de acordo com dataAtual.


======================================================
HORÁRIOS
======================================================

Use:

HH:MM

======================================================
MEMÓRIA PERMANENTE E CONTEXTO RELEVANTE
======================================================

Você recebe dois conjuntos de memória:

1. memoriasPermanentes
2. memoriasRelevantes


======================================================
memoriasRelevantes
======================================================

"memoriasRelevantes" contém as informações que o
sistema selecionou como mais úteis para a mensagem
atual.

Use essas memórias como contexto prioritário quando
forem realmente relacionadas ao pedido do usuário.

Use-as para personalizar respostas, sugestões,
planejamentos e decisões.

Não precisa mencionar explicitamente que está usando
uma memória.

Use a informação de maneira natural.


Exemplo:

Memória relevante:

"Prefere estudar Java à noite."

Usuário:

"Organize meu dia de amanhã."

Você pode considerar essa preferência ao sugerir
um horário para estudar Java.


Outro exemplo:

Memória relevante:

"Faculdade começa às 18:50."

Usuário:

"Organize meu dia."

Evite sugerir atividades que entrem em conflito
com esse horário.


======================================================
memoriasPermanentes
======================================================

"memoriasPermanentes" contém o conjunto completo de
memórias armazenadas do usuário.

Use o conjunto completo principalmente para:

- consultar o que está armazenado;
- identificar uma memória que deve ser esquecida;
- responder perguntas explícitas sobre memória;
- compreender informações quando necessário.

Para personalização normal da conversa,
priorize "memoriasRelevantes".


======================================================
REGRAS DE USO DA MEMÓRIA
======================================================

Memórias são contexto, não ordens absolutas.

Uma preferência pode orientar uma sugestão,
mas não deve impedir uma decisão diferente quando
a situação atual exigir.

Exemplo:

Memória:
"Prefere estudar à noite."

Se o usuário disser:
"Hoje quero estudar pela manhã."

A mensagem atual tem prioridade.

Nunca invente uma preferência ou rotina.

Nunca diga que o usuário possui um hábito apenas
porque ele fez algo uma vez.

Não force o uso de uma memória quando ela não for
relevante.

Não repita informações pessoais sem necessidade.

Não salve automaticamente tudo que o usuário disser.

Somente crie memória permanente quando o usuário
pedir explicitamente para lembrar, guardar,
memorizar ou salvar uma informação.


======================================================
AÇÃO: lembrar
======================================================

Use "lembrar" quando o usuário pedir explicitamente
para guardar uma informação sobre ele.

Exemplos:

"Lembre que prefiro estudar Java à noite."
"Guarde que minha faculdade começa às 18:50."
"Memorize que prefiro respostas mais curtas."

Nesse caso:

acao = "lembrar"

memoria = informação que deverá ser armazenada

categoria = categoria apropriada da memória

Categorias recomendadas:

"preferencia"
"estudo"
"rotina"
"trabalho"
"pessoal"
"geral"

Exemplo:

Usuário:
"LIA, lembre que prefiro estudar Java à noite."

Resultado esperado:

acao = "lembrar"
memoria = "Prefere estudar Java à noite"
categoria = "estudo"
memoriaId = 

======================================================
AÇÃO: atualizar_memoria
======================================================

Use "atualizar_memoria" quando o usuário pedir
explicitamente para lembrar uma informação nova
que substitui ou corrige uma memória permanente
já existente.

Antes de criar uma nova memória com "lembrar",
verifique "memoriasPermanentes".

Se já existir uma memória sobre o mesmo assunto
e a nova informação substituir a anterior,
não crie outra memória.

Use:

acao = "atualizar_memoria"

memoriaId = ID da memória antiga que será atualizada

memoria = novo conteúdo que substituirá a memória antiga

categoria = categoria apropriada da memória


Exemplo:

Memória existente:

"Tem academia às 16:30"

Usuário:

"LIA, agora minha academia será às 17:30.
Lembre disso."

Resultado esperado:

acao = "atualizar_memoria"

memoriaId = ID da memória
"Tem academia às 16:30"

memoria = "Tem academia às 17:30"

categoria = "rotina"


Outro exemplo:

Memória existente:

"Prefere estudar Java à noite"

Usuário:

"Lembre que agora prefiro estudar Java
pela manhã."

Resultado esperado:

acao = "atualizar_memoria"

memoriaId = ID da memória antiga

memoria = "Prefere estudar Java pela manhã"

categoria = "estudo"


======================================================
DIFERENÇA ENTRE LEMBRAR E ATUALIZAR
======================================================

Use "lembrar" quando a informação for nova e não
substituir uma memória existente.

Use "atualizar_memoria" quando a informação nova
corrigir, alterar ou substituir uma memória
existente sobre o mesmo assunto.

Não mantenha duas memórias contraditórias quando
estiver claro que a informação nova substitui
a anterior.

A informação mais recente explicitamente fornecida
pelo usuário deve substituir a antiga.

Nunca invente memoriaId.

Somente use "atualizar_memoria" quando conseguir
identificar com segurança a memória antiga em
"memoriasPermanentes".

Se não houver memória anterior relacionada,
use "lembrar".


======================================================
AÇÃO: consultar_memorias
======================================================

Use "consultar_memorias" quando o usuário quiser
saber quais informações estão armazenadas sobre ele.

Exemplos:

"O que você lembra sobre mim?"
"O que você sabe sobre mim?"
"Quais informações você guardou sobre mim?"

Nesse caso:

acao = "consultar_memorias"

memoria = null
categoria = null
memoriaId = null


======================================================
AÇÃO: esquecer
======================================================

Use "esquecer" somente quando o usuário pedir
explicitamente para apagar uma memória permanente.

Exemplos:

"Esqueça que prefiro estudar Java à noite."
"Não quero mais que você guarde essa informação."
"Apague essa memória."

Use "memoriasPermanentes" para identificar
a memória correta.

Quando houver uma correspondência clara:

acao = "esquecer"
memoriaId = ID da memória correspondente

Se não houver uma correspondência segura,
não invente um ID.

Nesse caso use memoriaId = null e coloque em
memoria uma descrição da informação que o usuário
deseja esquecer.


IMPORTANTE:

Memória permanente é diferente do histórico
temporário da conversa.

historicoConversa serve para manter o contexto
da conversa atual.

memoriasPermanentes contém todas as memórias
persistentes do usuário.

memoriasRelevantes contém apenas as memórias
selecionadas para ajudar no pedido atual.

Nunca transforme tarefas, compromissos ou comandos
comuns em memórias permanentes sem que o usuário
tenha pedido explicitamente para lembrar.

======================================================
ESTADO CONTEXTUAL DO USUÁRIO
======================================================

Analise somente o tom e o conteúdo da mensagem atual
e do histórico recente para estimar o estado contextual
do usuário.

Use apenas um destes valores:

neutro
animado
cansado
preocupado
frustrado

Não faça diagnóstico psicológico ou médico.

Não trate esse estado como verdade permanente.

Não salve esse estado na memória permanente.

Use "neutro" quando não houver sinais suficientes.


Exemplos:

"Hoje estou exausto e ainda tenho muita coisa para fazer."

estadoEmocional = "cansado"


"Estou muito preocupado com essa prova."

estadoEmocional = "preocupado"


"Finalmente consegui terminar meu projeto!"

estadoEmocional = "animado"


"Isso não funciona de jeito nenhum, já tentei várias vezes."

estadoEmocional = "frustrado"


"Quais tarefas tenho para amanhã?"

estadoEmocional = "neutro"


Adapte a resposta de forma sutil ao contexto.


Para "cansado":

Seja mais direto, calmo e evite sobrecarregar
o usuário com muitas informações de uma vez.


Para "preocupado":

Seja claro, organizado e tranquilizador,
sem dramatizar.


Para "frustrado":

Seja objetivo, paciente e focado
em resolver o problema.


Para "animado":

Pode usar um tom um pouco mais energético
e positivo.


Para "neutro":

Use o tom normal da LIA.

======================================================
REGRAS IMPORTANTES
======================================================

Não invente título, data ou horário.

Quando uma informação não existir,
retorne null.

Não use Markdown.

Não diga que executou uma ação quando
requerConfirmacao for true.

A resposta deve ser natural e adequada
ao contexto da conversa.
                    `,


                    input: `
======================================================
CONTEXTO ATUAL
======================================================

${JSON.stringify(
    contexto,
    null,
    2
)}


======================================================
MENSAGEM ATUAL DO USUÁRIO
======================================================

${mensagemAtual}
                    `,


                    text: {

                        format: {

                            type:
                                "json_schema",

                            name:
                                "lia_response",

                            strict:
                                true,

                            schema: {

                                type:
                                    "object",

                                properties: {

                                    resposta: {

                                        type:
                                            "string"
                                    },


                                    requerConfirmacao: {

                                        type:
                                            "boolean"
                                    },


                                    cancelarPendentes: {

                                        type:
                                            "boolean"
                                    }, 

                                    estadoEmocional: {

                                        type:
                                            "string",

                                        enum: [
                                           "neutro",
                                           "animado",
                                           "cansado",
                                           "preocupado",
                                           "frustrado"
                                         ]
                                    },



                                    acoes: {

                                        type:
                                            "array",

                                        items: {

                                            type:
                                                "object",

                                            properties: {

                                                acao: {

                                                    type:
                                                        "string",

                                                    enum: [
                                                        "conversar",
                                                        "criar_tarefa",
                                                        "agendar",
                                                        "alterar",
                                                        "excluir",
                                                        "concluir",
                                                        "consultar_tarefas",
                                                        "consultar_agenda",
                                                        "atualizar_memoria",
                                                        "lembrar",
                                                        "consultar_memorias",
                                                        "esquecer"
                                                    ]
                                                },


                                                titulo: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                },


                                                data: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                },


                                                horario: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                },


                                                novoTitulo: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                },


                                                novaData: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                },


                                               novoHorario: {
                                                 type: [
                                                    "string",
                                                    "null"
                                                 ] 
                                                    
                                                
                                                
                                                },
                                                memoria: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                },

                                                categoria: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                },

                                                memoriaId: {

                                                    type: [
                                                        "string",
                                                        "null"
                                                    ]
                                                }

                                            },

                                                    


                                            required: [
                                                "acao",
                                                "titulo",
                                                "data",
                                                "horario",
                                                "novoTitulo",
                                                "novaData",
                                                "novoHorario",
                                                "memoria",
                                                "categoria",
                                                "memoriaId"
                                            ],


                                            additionalProperties:
                                                false
                                        }
                                    }

                                },


                                required: [
                                    "resposta",
                                    "requerConfirmacao",
                                    "cancelarPendentes",
                                    "estadoEmocional",
                                    "acoes"
                                ],


                                additionalProperties:
                                    false
                            }
                        }
                    }
                });

                                                                         
                                
                                                         

const tempoIA =
    (
        performance.now() -
        inicioIA
    ) / 1000;

console.log(
    `[LIA] Tempo de resposta da IA: ${tempoIA.toFixed(2)} segundos`
);


                                                                 
                                           
                                                                 

            const resultado =
                JSON.parse(
                    response.output_text
                );


            if (
                !Array.isArray(
                    resultado.acoes
                )
            ) {

                resultado.acoes =
                    [];
            }

                                                                      
                               
                                                         

const usuarioId =
    req.session
        .usuario
        .id;


const acoesParaApp =
    [];


const respostasMemoria =
    [];


for (
    const acao of
    resultado.acoes
) {

    if (
        !acao ||
        typeof acao !==
            "object"
    ) {

        continue;
    }


                                                         
              
                                                         

    if (
        acao.acao ===
        "lembrar"
    ) {

        if (
            acao.memoria &&
            String(
                acao.memoria
            ).trim()
        ) {

            const memoriaSalva =
                adicionarMemoriaUsuario(
                    usuarioId,
                    acao.memoria,
                    acao.categoria ||
                        "geral"
                );


            if (
                memoriaSalva
            ) {

                respostasMemoria.push(
                    `Certo. Vou lembrar que ${memoriaSalva.conteudo}.`
                );
            }

        } else {

            respostasMemoria.push(
                "Não consegui identificar o que você deseja que eu lembre."
            );
        }


        continue;
    }

                                                             
                    
                                                         

if (
    acao.acao ===
    "atualizar_memoria"
) {

    if (
        acao.memoriaId &&
        acao.memoria &&
        String(
            acao.memoria
        ).trim()
    ) {

        const memoriaAtualizada =
            atualizarMemoriaUsuario(
                usuarioId,
                acao.memoriaId,
                acao.memoria,
                acao.categoria ||
                    null
            );


        if (
            memoriaAtualizada
        ) {

            respostasMemoria.push(
                `Certo. Atualizei essa informação para: ${memoriaAtualizada.conteudo}.`
            );

        } else {

            respostasMemoria.push(
                "Não consegui localizar com segurança a memória que deveria ser atualizada."
            );
        }

    } else {

        respostasMemoria.push(
            "Não consegui identificar com segurança qual memória deveria ser atualizada."
        );
    }


    continue;
}


                                                         
                         
                                                         

    if (
        acao.acao ===
        "consultar_memorias"
    ) {

        const memorias =
            obterMemoriasUsuario(
                usuarioId
            );


        if (
            memorias.length ===
            0
        ) {

            respostasMemoria.push(
                "Ainda não tenho nenhuma memória permanente salva sobre você."
            );

        } else {

            const textoMemorias =
                memorias
                    .map(
                        memoria =>
                            memoria.conteudo
                    )
                    .join("; ");


            respostasMemoria.push(
                `Estas são algumas informações que lembro sobre você: ${textoMemorias}.`
            );
        }


        continue;
    }


                                                         
               
                                                         

    if (
        acao.acao ===
        "esquecer"
    ) {

        const memorias =
            obterMemoriasUsuario(
                usuarioId
            );


        let memoriaEncontrada =
            null;


                                                         
                                  
                                                         

        if (
            acao.memoriaId
        ) {

            memoriaEncontrada =
                memorias.find(
                    memoria =>
                        memoria.id ===
                        acao.memoriaId
                );
        }


                                                         
                               
                                                         

        if (
            !memoriaEncontrada &&
            acao.memoria
        ) {

            const busca =
                normalizarTextoConversa(
                    acao.memoria
                );


            memoriaEncontrada =
                memorias.find(
                    memoria => {

                        const conteudo =
                            normalizarTextoConversa(
                                memoria.conteudo
                            );


                        return (
                            conteudo ===
                                busca ||
                            conteudo.includes(
                                busca
                            ) ||
                            busca.includes(
                                conteudo
                            )
                        );
                    }
                );
        }


                                                         
                  
                                                         

        if (
            memoriaEncontrada
        ) {

            const excluiu =
                excluirMemoriaUsuario(
                    usuarioId,
                    memoriaEncontrada.id
                );


            if (
                excluiu
            ) {

                respostasMemoria.push(
                    `Certo. Esqueci a informação: ${memoriaEncontrada.conteudo}.`
                );

            } else {

                respostasMemoria.push(
                    "Não consegui apagar essa memória."
                );
            }

        } else {

            respostasMemoria.push(
                "Não encontrei essa informação nas minhas memórias."
            );
        }


        continue;
    }


                                                         
                                           
                                                         

    acoesParaApp.push(
        acao
    );
}


                                                         
                                                   
                                                         

resultado.acoes =
    acoesParaApp;


                                                         
                      
                                                         

if (
    respostasMemoria.length >
        0 &&
    resultado.acoes.length ===
        0
) {

    resultado.resposta =
        respostasMemoria.join(
            " "
        );


    resultado.requerConfirmacao =
        false;


    resultado.cancelarPendentes =
        false;
}
                                                                 
                                            
                                                                 

            const novasAcoes =
                resultado.acoes.filter(
                    item =>
                        item.acao ===
                            "criar_tarefa" ||
                        item.acao ===
                            "agendar"
                );


              
                                             
                                                  
                                                 
                                                   
              

            if (
                novasAcoes.length >= 2
            ) {

                resultado
                    .requerConfirmacao =
                    true;
            }


                                                                 
                                 
                                                                 

            if (
                resultado.cancelarPendentes
            ) {

                req.session
                    .liaAcoesPendentes =
                    [];
            }


                                                                 
                                      
                                                                 

            else if (
                resultado
                    .requerConfirmacao &&
                resultado.acoes.length > 0
            ) {

                req.session
                    .liaAcoesPendentes =
                    structuredClone(
                        resultado.acoes
                    );


                if (
                    !resultado.resposta ||
                    !resultado
                        .resposta
                        .trim()
                ) {

                    resultado.resposta =
                        montarConfirmacaoLia(
                            resultado.acoes
                        );
                }
            }


                                                                 
                                          
                                                                 

            else if (
                !resultado
                    .requerConfirmacao &&
                resultado.acoes.length > 0
            ) {

                req.session
                    .liaAcoesPendentes =
                    [];
            }


                                                                 
                               
                                                                 

            adicionarHistoricoLia(
                req,
                "usuario",
                mensagemAtual
            );


            adicionarHistoricoLia(
                req,
                "lia",
                resultado.resposta
            );


            console.log(
                "Quantidade de ações:",
                resultado.acoes.length
            );


            console.log(
                "Requer confirmação:",
                resultado
                    .requerConfirmacao
            );


            return res.json(
                resultado
            );


        } catch (erro) {

            console.error("");

            console.error(
                "ERRO OPENAI:"
            );

            console.error(
                erro
            );


                                                                 
                       
                                                                 

            if (
                erro.code ===
                    "credit_balance_exhausted" ||

                erro.type ===
                    "insufficient_quota"
            ) {

                return res
                    .status(429)
                    .json({
                        erro:
                            "Os créditos da API da LIA acabaram."
                    });
            }


                                                                 
                                    
                                                                 

            if (
                erro.status === 429
            ) {

                return res
                    .status(429)
                    .json({
                        erro:
                            "Muitas solicitações em pouco tempo."
                    });
            }


                                                                 
                         
                                                                 

            return res
                .status(500)
                .json({
                    erro:
                        "Não foi possível processar a solicitação da LIA."
                });
        }

    }
);

                                                         
                    
                                                         

app.post(
    "/api/voz",

    exigirLogin,
    limitarUsoIA(
        "voice",
        IA_VOICE_RATE_LIMIT,
        IA_GLOBAL_VOICE_DAILY_LIMIT
    ),

    async (req, res) => {

        try {

            const {
                texto,
                 estadoEmocional = "neutro"
            } = req.body;


                                                         
                            
                                                         

            if (
                !texto ||
                typeof texto !== "string" ||
                !texto.trim()
            ) {

                return res
                    .status(400)
                    .json({
                        erro:
                            "Nenhum texto válido foi enviado para a voz."
                    });
            }

            if (texto.trim().length > 1000) {
                return res.status(400).json({
                    erro: "O texto para voz deve ter no máximo 1.000 caracteres."
                });
            }


                                                         
                              
                                                         

            const textoVoz = texto.trim();


            console.log("");

            console.log(
                "Gerando voz neural da LIA..."
            );


                                                                     
                                           
                                                         

let instrucaoEmocional =
    `
Fale com um tom natural, equilibrado,
acolhedor e humano.
    `;


switch (
    estadoEmocional
) {

    case "cansado":

        instrucaoEmocional =
            `
Fale de forma mais calma, suave e um pouco mais lenta.

Use pausas naturais.

Evite excesso de energia.

Transmita tranquilidade e proximidade.

Não soe triste ou dramática.
            `;

        break;


    case "preocupado":

        instrucaoEmocional =
            `
Fale com calma, segurança e clareza.

Use um ritmo confortável.

A entonação deve transmitir organização,
estabilidade e confiança.

Evite dramatizar ou soar excessivamente preocupada.
            `;

        break;


    case "frustrado":

        instrucaoEmocional =
            `
Fale de forma paciente, clara e objetiva.

Use uma entonação estável e compreensiva.

Transmita a sensação de que você está focada
em resolver o problema junto com o usuário.

Evite parecer animada demais ou condescendente.
            `;

        break;


    case "animado":

        instrucaoEmocional =
            `
Fale com um pouco mais de energia e entusiasmo.

A voz deve soar positiva, natural e envolvente.

Use uma entonação levemente mais expressiva,
sem exagerar.
            `;

        break;


    case "neutro":

    default:

        instrucaoEmocional =
            `
Fale de maneira natural, equilibrada,
acolhedora e inteligente.

Use ritmo confortável e entonação humana.
            `;

        break;
}


                                                         
                                    
                                                         

            const audio =
                await openai.audio.speech.create({

                    model:
                        "gpt-4o-mini-tts",

                    voice:
                        "coral",

                    input:
                        textoVoz,

                    instructions: `
Fale em português brasileiro como LIA, em uma conversa individual.
Entregue o texto com naturalidade, como uma pessoa falando com alguém
que conhece: ritmo fluido, pequenas variações de entonação e pausas
apenas onde a pontuação pedir. Use uma voz acolhedora e segura, sem
interpretar cada frase, sem teatralidade e sem soar como locutora ou
assistente automática. Não acrescente palavras nem leia instruções.
Pronuncie datas, horários e nomes de forma natural em português brasileiro.


${instrucaoEmocional}
                    `,

                    response_format:
                        "mp3"
                });


                                                         
                                
                                             

res.setHeader(
    "Content-Type",
    "audio/mpeg"
);

res.setHeader(
    "Cache-Control",
    "no-store"
);

res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
);

                                        
                                  

const streamAudio =
    audio.body;

if (!streamAudio) {
    throw new Error(
        "A OpenAI não retornou um fluxo de áudio."
    );
}

const { Readable } =
    await import("node:stream");

const streamNode =
    Readable.fromWeb(streamAudio);

streamNode.on("error", erro => {
    console.error(
        "Erro na transmissão de áudio:",
        erro
    );

    res.destroy(erro);
});

streamNode.pipe(res);


        } catch (erro) {

            console.error("");

            console.error(
                "ERRO NA VOZ NEURAL DA LIA:"
            );

            console.error(
                erro
            );


                                                         
                               
                                                         

            if (
                erro.code ===
                    "credit_balance_exhausted" ||

                erro.type ===
                    "insufficient_quota"
            ) {

                return res
                    .status(429)
                    .json({
                        erro:
                            "Os créditos da API para voz acabaram."
                    });
            }


                                                         
                                  
                                                         

            if (
                erro.status === 429
            ) {

                return res
                    .status(429)
                    .json({
                        erro:
                            "Muitas solicitações de voz em pouco tempo."
                    });
            }


                                                         
                         
                                                         

            return res
                .status(500)
                .json({
                    erro:
                        "Não foi possível gerar a voz da LIA."
                });
        }
    }
);

                                                         
                   
                                                         

function iniciarServidor() {

    return app.listen(
        PORT,
        () => {

            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                " LIA - LIFE INTELLIGENCE ASSISTANT"
            );

            console.log(
                " Cadastro + Login + Sessão ativados"
            );

            console.log(
                ` http://localhost:${PORT}`
            );

            console.log(
                "========================================"
            );

            console.log("");
        }
    );
}

const closeItemStore = () => itemStore.close();
const closeSessionStore = () => sessionStore.close();
const closeUsageLimiter = () => usageLimiter.close();
const closeObjectiveStore = () => objectiveStore.close();

export {
    app,
    iniciarServidor,
    closeItemStore,
    closeSessionStore,
    closeUsageLimiter,
    closeObjectiveStore
};

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === __filename
) {
    iniciarServidor();
}