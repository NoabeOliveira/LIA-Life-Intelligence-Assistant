import {
    dataDeAmanha,
    dataDeHoje,
    formatarDataBrasileira
} from "./date-utils.js";

export function createDashboardRenderer({
    getItems,
    onCreateTask,
    onPlanToday,
    documentRef = document
}) {

    function ordenarPorDataEHorario(a, b) {

        const dataA =
            `${a.data || "9999-99-99"} ${a.horario || "99:99"}`;
        const dataB =
            `${b.data || "9999-99-99"} ${b.horario || "99:99"}`;

        return dataA.localeCompare(dataB);
    }

    function atualizarTarefas() {

        const lista = documentRef.getElementById("listaTarefas");

        if (!lista) {
            return;
        }

        lista.innerHTML = "";

        const tarefas = getItems()
            .filter(item => item.tipo === "tarefa")
            .sort((a, b) => {

                if (a.concluido !== b.concluido) {
                    return a.concluido ? 1 : -1;
                }

                return ordenarPorDataEHorario(a, b);
            });

        if (tarefas.length === 0) {

            lista.innerHTML = `
                <div class="empty-state empty-state-action">
                    <p>Você ainda não tem tarefas. Comece por uma pequena ação.</p>
                    <button
                        type="button"
                        class="empty-state-button"
                        id="atalhoCriarTarefaVazia"
                    >
                        Criar primeira tarefa
                    </button>
                </div>
            `;

            documentRef
                .getElementById("atalhoCriarTarefaVazia")
                ?.addEventListener("click", onCreateTask);

            return;
        }

        tarefas.slice(0, 5).forEach(tarefa => {

            const elemento = documentRef.createElement("div");
            elemento.className = "item-tarefa";

            if (tarefa.concluido) {
                elemento.classList.add("concluido");
            }

            const titulo = documentRef.createElement("strong");
            titulo.textContent = tarefa.titulo;

            const detalhes = documentRef.createElement("small");
            const partes = [];

            if (tarefa.data) {

                if (tarefa.data === dataDeHoje()) {
                    partes.push("Hoje");
                } else if (tarefa.data === dataDeAmanha()) {
                    partes.push("Amanhã");
                } else {
                    partes.push(formatarDataBrasileira(tarefa.data));
                }
            }

            if (tarefa.horario) {
                partes.push(tarefa.horario);
            }

            if (tarefa.concluido) {
                partes.push("Concluída");
            }

            detalhes.textContent = partes.join(" • ");
            elemento.appendChild(titulo);

            if (partes.length > 0) {
                elemento.appendChild(detalhes);
            }

            lista.appendChild(elemento);
        });
    }

    function atualizarAgenda() {

        const lista = documentRef.getElementById("listaAgenda");

        if (!lista) {
            return;
        }

        lista.innerHTML = "";

        const agenda = getItems()
            .filter(item => item.tipo === "compromisso")
            .sort(ordenarPorDataEHorario);

        if (agenda.length === 0) {
            lista.innerHTML = `
                <p class="sem-itens">
                    Nenhum compromisso cadastrado.
                </p>
            `;
            return;
        }

        agenda.forEach(compromisso => {

            const elemento = documentRef.createElement("div");
            elemento.className = "item-agenda";

            const titulo = documentRef.createElement("strong");
            titulo.textContent = compromisso.titulo;

            const detalhes = documentRef.createElement("small");
            const partes = [];

            if (compromisso.data) {
                partes.push(formatarDataBrasileira(compromisso.data));
            }

            if (compromisso.horario) {
                partes.push(compromisso.horario);
            }

            detalhes.textContent = partes.join(" • ");
            elemento.appendChild(titulo);

            if (partes.length > 0) {
                elemento.appendChild(detalhes);
            }

            lista.appendChild(elemento);
        });
    }

    function atualizarResumoAgenda() {

        const compromissos = getItems()
            .filter(item => item.tipo === "compromisso");
        const quantidadeHoje =
            compromissos.filter(item => item.data === dataDeHoje()).length;
        const quantidadeAmanha =
            compromissos.filter(item => item.data === dataDeAmanha()).length;

        const totalHoje = documentRef.getElementById("totalHoje");
        const totalAmanha = documentRef.getElementById("totalAmanha");
        const totalAgenda = documentRef.getElementById("totalAgenda");

        if (totalHoje) {
            totalHoje.textContent = quantidadeHoje;
        }

        if (totalAmanha) {
            totalAmanha.textContent = quantidadeAmanha;
        }

        if (totalAgenda) {
            totalAgenda.textContent = compromissos.length;
        }
    }

    function atualizarResumoDashboard() {

        const hoje = dataDeHoje();
        const itens = getItems();
        const tarefasHoje = itens.filter(item => (
            item.tipo === "tarefa" &&
            item.data === hoje &&
            !item.concluido
        ));
        const compromissosHoje = itens.filter(item => (
            item.tipo === "compromisso" &&
            item.data === hoje
        ));
        const tarefasAbertas = itens.filter(item => (
            item.tipo === "tarefa" &&
            !item.concluido
        )).length;
        const tarefasConcluidas = itens.filter(item => (
            item.tipo === "tarefa" &&
            item.concluido
        )).length;

        const resumoTarefasHoje =
            documentRef.getElementById("resumoTarefasHoje");
        const resumoCompromissosHoje =
            documentRef.getElementById("resumoCompromissosHoje");
        const resumoTarefasAbertas =
            documentRef.getElementById("resumoTarefasAbertas");
        const resumoTarefasConcluidas =
            documentRef.getElementById("resumoTarefasConcluidas");

        if (resumoTarefasHoje) {
            resumoTarefasHoje.textContent = tarefasHoje.length;
        }

        if (resumoCompromissosHoje) {
            resumoCompromissosHoje.textContent = compromissosHoje.length;
        }

        if (resumoTarefasAbertas) {
            resumoTarefasAbertas.textContent = tarefasAbertas;
        }

        if (resumoTarefasConcluidas) {
            resumoTarefasConcluidas.textContent = tarefasConcluidas;
        }
    }

    function atualizarPlanoHoje() {

        const plano = documentRef.getElementById("planoHoje");

        if (!plano) {
            return;
        }

        plano.innerHTML = "";

        const itensHoje = getItems()
            .filter(item => item.data === dataDeHoje() && !item.concluido)
            .sort((a, b) => (
                (a.horario || "99:99").localeCompare(
                    b.horario || "99:99"
                )
            ));

        if (itensHoje.length === 0) {
            plano.innerHTML = `
                <div class="empty-state empty-state-action">
                    <p>Seu dia ainda está livre de atividades.</p>
                    <button
                        type="button"
                        class="empty-state-button"
                        id="atalhoOrganizarDiaVazio"
                    >
                        Planejar meu dia
                    </button>
                </div>
            `;

            documentRef
                .getElementById("atalhoOrganizarDiaVazio")
                ?.addEventListener("click", onPlanToday);

            return;
        }

        itensHoje.forEach(item => {

            const elemento = documentRef.createElement("div");
            elemento.className = "timeline-item";

            const horario = documentRef.createElement("span");
            horario.className = "timeline-time";
            horario.textContent = item.horario || "--:--";

            const ponto = documentRef.createElement("span");
            ponto.className = "timeline-dot";

            const conteudo = documentRef.createElement("div");
            conteudo.className = "timeline-content";

            const titulo = documentRef.createElement("strong");
            titulo.textContent = item.titulo;

            const tipo = documentRef.createElement("span");
            tipo.textContent = item.tipo === "compromisso" ?
                "Compromisso" :
                "Tarefa";

            conteudo.appendChild(titulo);
            conteudo.appendChild(tipo);
            elemento.appendChild(horario);
            elemento.appendChild(ponto);
            elemento.appendChild(conteudo);
            plano.appendChild(elemento);
        });
    }

    return {
        render() {
            atualizarTarefas();
            atualizarAgenda();
            atualizarResumoAgenda();
            atualizarResumoDashboard();
            atualizarPlanoHoje();
        }
    };
}
