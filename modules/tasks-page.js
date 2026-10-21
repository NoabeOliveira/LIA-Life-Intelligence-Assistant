import { formatarDataBrasileira } from "./date-utils.js";

export function createTasksPage({
    getItems,
    onCreateTask,
    onToggleTask,
    onDeleteTask,
    documentRef = document
}) {

    let filtroAtual = "todas";

    const form = documentRef.getElementById("taskCreateForm");
    const titleInput = documentRef.getElementById("taskTitle");
    const dateInput = documentRef.getElementById("taskDate");
    const timeInput = documentRef.getElementById("taskTime");
    const list = documentRef.getElementById("taskPageList");
    const filters = documentRef.getElementById("taskFilters");

    function criarBotao(texto, classe, onClick, label) {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = classe;
        button.textContent = texto;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", onClick);
        return button;
    }

    function renderizarFiltros() {

        if (!filters) {
            return;
        }

        filters.replaceChildren();

        [
            ["todas", "Todas"],
            ["abertas", "Em aberto"],
            ["concluidas", "Concluídas"]
        ].forEach(([filtro, texto]) => {

            const button = criarBotao(
                texto,
                "task-filter",
                () => {
                    filtroAtual = filtro;
                    render();
                },
                `Filtrar tarefas: ${texto.toLowerCase()}`
            );

            button.setAttribute(
                "aria-pressed",
                String(filtroAtual === filtro)
            );

            if (filtroAtual === filtro) {
                button.classList.add("active");
            }

            filters.appendChild(button);
        });
    }

    function renderizarTarefas() {

        if (!list) {
            return;
        }

        list.replaceChildren();

        const tarefas = getItems()
            .filter(item => item.tipo === "tarefa")
            .filter(item => {

                if (filtroAtual === "abertas") {
                    return !item.concluido;
                }

                if (filtroAtual === "concluidas") {
                    return item.concluido;
                }

                return true;
            })
            .sort((a, b) => {

                if (a.concluido !== b.concluido) {
                    return a.concluido ? 1 : -1;
                }

                const dataA = `${a.data || "9999-99-99"} ${a.horario || "99:99"}`;
                const dataB = `${b.data || "9999-99-99"} ${b.horario || "99:99"}`;
                return dataA.localeCompare(dataB);
            });

        if (tarefas.length === 0) {
            const emptyState = documentRef.createElement("p");
            emptyState.className = "task-page-empty";
            emptyState.textContent = filtroAtual === "concluidas" ?
                "Você ainda não concluiu nenhuma tarefa." :
                filtroAtual === "abertas" ?
                    "Você não tem tarefas em aberto." :
                    "Você ainda não tem tarefas. Crie a primeira acima.";
            list.appendChild(emptyState);
            return;
        }

        tarefas.forEach(tarefa => {

            const row = documentRef.createElement("article");
            row.className = "task-page-row";

            if (tarefa.concluido) {
                row.classList.add("completed");
            }

            const toggle = criarBotao(
                tarefa.concluido ? "✓" : "",
                "task-complete-toggle",
                () => onToggleTask(tarefa.id),
                tarefa.concluido ?
                    `Reabrir tarefa: ${tarefa.titulo}` :
                    `Concluir tarefa: ${tarefa.titulo}`
            );
            toggle.setAttribute("aria-pressed", String(tarefa.concluido));

            const content = documentRef.createElement("div");
            content.className = "task-page-content";

            const title = documentRef.createElement("strong");
            title.textContent = tarefa.titulo;
            content.appendChild(title);

            const details = [];

            if (tarefa.data) {
                details.push(formatarDataBrasileira(tarefa.data));
            }

            if (tarefa.horario) {
                details.push(tarefa.horario);
            }

            if (details.length > 0) {
                const detailText = documentRef.createElement("small");
                detailText.textContent = details.join(" • ");
                content.appendChild(detailText);
            }

            const remove = criarBotao(
                "Excluir",
                "task-delete-button",
                () => onDeleteTask(tarefa.id),
                `Excluir tarefa: ${tarefa.titulo}`
            );

            row.append(toggle, content, remove);
            list.appendChild(row);
        });
    }

    function render() {
        renderizarFiltros();
        renderizarTarefas();
    }

    form?.addEventListener("submit", evento => {

        evento.preventDefault();

        const titulo = titleInput?.value.trim() || "";

        if (!titulo) {
            titleInput?.focus();
            return;
        }

        const criada = onCreateTask({
            titulo,
            data: dateInput?.value || null,
            horario: timeInput?.value || null
        });

        if (criada) {
            form.reset();
            titleInput?.focus();
            render();
        }
    });

    return { render };
}
