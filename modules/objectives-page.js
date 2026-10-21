import { extrairMensagemErroApi } from "./ux.js";
import { formatarDataBrasileira } from "./date-utils.js";

export function createObjectivesPage({
    onAuthenticationExpired = () => {},
    fetcher = fetch,
    confirmAction = message => globalThis.confirm(message),
    documentRef = document
}) {

    const page = documentRef.getElementById("objetivosPage");
    const form = documentRef.getElementById("objectiveCreateForm");
    const titleInput = documentRef.getElementById("objectiveTitle");
    const deadlineInput = documentRef.getElementById("objectiveDeadline");
    const milestonesInput = documentRef.getElementById("objectiveMilestones");
    const list = documentRef.getElementById("objectiveList");
    const status = documentRef.getElementById("objectiveStatus");
    const statusText = documentRef.getElementById("objectiveStatusText");
    const retryLoadButton =
        documentRef.getElementById("objectiveRetryLoad");
    const dashboardSummary =
        documentRef.getElementById("dashboardObjectiveSummary");
    const returnButton =
        documentRef.getElementById("voltarMeuDiaObjetivos");

    let objectives = [];
    let busy = false;
    let loaded = false;

    function setStatus(message, isError = false, allowRetry = false) {

        if (!status) {
            return;
        }

        if (statusText) {
            statusText.textContent = message;
        } else {
            status.textContent = message;
        }
        status.hidden = !message;
        status.classList.toggle("sync-error", isError);
        if (retryLoadButton) {
            retryLoadButton.hidden = !allowRetry;
        }
    }

    async function request(url, options = {}) {

        const response = await fetcher(url, {
            credentials: "same-origin",
            ...options,
            ...(options.body ? {
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers
                }
            } : {})
        });
        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error("O servidor retornou uma resposta inválida.");
        }

        if (response.status === 401) {
            onAuthenticationExpired();
            throw new Error(
                "Sua sessão expirou. Faça login novamente."
            );
        }

        if (!response.ok) {
            throw new Error(
                extrairMensagemErroApi(
                    data,
                    "Não foi possível concluir a operação."
                )
            );
        }

        return data;
    }

    function createButton(label, className, onClick, ariaLabel = label) {

        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.setAttribute("aria-label", ariaLabel);
        button.disabled = busy;
        button.addEventListener("click", onClick);
        return button;
    }

    function renderDashboardSummary() {

        if (!dashboardSummary) {
            return;
        }

        if (!loaded) {
            dashboardSummary.textContent =
                "Carregando seus objetivos...";
            return;
        }

        if (objectives.length === 0) {
            dashboardSummary.textContent =
                "Defina um objetivo e transforme-o em etapas.";
            return;
        }

        const completed = objectives.filter(
            objective => objective.progresso === 100
        ).length;
        dashboardSummary.textContent =
            `${objectives.length} objetivo(s) em acompanhamento · ${completed} concluído(s).`;
    }

    function ordenarObjetivos() {
        objectives.sort((a, b) => {
            const dateA = a.dataLimite || "9999-99-99";
            const dateB = b.dataLimite || "9999-99-99";
            return dateA.localeCompare(dateB) ||
                a.criadoEm.localeCompare(b.criadoEm);
        });
    }

    function renderMilestone(objective, milestone) {

        const row = documentRef.createElement("div");
        row.className = "objective-milestone";

        if (milestone.concluida) {
            row.classList.add("completed");
        }

        const toggle = createButton(
            milestone.concluida ? "✓" : "",
            "objective-milestone-toggle",
            () => updateMilestone(
                objective.id,
                milestone.id,
                !milestone.concluida
            ),
            milestone.concluida ?
                `Reabrir etapa: ${milestone.titulo}` :
                `Concluir etapa: ${milestone.titulo}`
        );
        toggle.setAttribute("aria-pressed", String(milestone.concluida));

        const title = documentRef.createElement("span");
        title.textContent = milestone.titulo;

        const remove = createButton(
            "×",
            "objective-milestone-delete",
            () => removeMilestone(objective.id, milestone),
            `Excluir etapa: ${milestone.titulo}`
        );

        row.append(toggle, title, remove);
        return row;
    }

    function renderObjective(objective) {

        const card = documentRef.createElement("article");
        card.className = "objective-card";

        const header = documentRef.createElement("header");
        header.className = "objective-card-header";

        const heading = documentRef.createElement("div");
        heading.className = "objective-card-heading";

        const title = documentRef.createElement("h2");
        title.textContent = objective.titulo;
        heading.appendChild(title);

        if (objective.dataLimite) {
            const deadline = documentRef.createElement("small");
            deadline.textContent =
                `Prazo: ${formatarDataBrasileira(objective.dataLimite)}`;
            heading.appendChild(deadline);
        }

        const deleteObjective = createButton(
            "Excluir objetivo",
            "objective-delete-button",
            () => removeObjective(objective),
            `Excluir objetivo: ${objective.titulo}`
        );
        header.append(heading, deleteObjective);

        const progressHeader = documentRef.createElement("div");
        progressHeader.className = "objective-progress-header";

        const progressLabel = documentRef.createElement("span");
        progressLabel.textContent =
            `${objective.etapas.filter(etapa => etapa.concluida).length} de ${objective.etapas.length} etapas`;

        const progressPercentage = documentRef.createElement("strong");
        progressPercentage.textContent = `${objective.progresso}%`;

        progressHeader.append(progressLabel, progressPercentage);

        const progressBar = documentRef.createElement("div");
        progressBar.className = "objective-progress-track";
        progressBar.setAttribute("role", "progressbar");
        progressBar.setAttribute("aria-label", `Progresso: ${objective.titulo}`);
        progressBar.setAttribute("aria-valuemin", "0");
        progressBar.setAttribute("aria-valuemax", "100");
        progressBar.setAttribute("aria-valuenow", String(objective.progresso));

        const progressFill = documentRef.createElement("span");
        progressFill.style.width = `${objective.progresso}%`;
        progressBar.appendChild(progressFill);

        const milestoneList = documentRef.createElement("div");
        milestoneList.className = "objective-milestone-list";

        objective.etapas.forEach(etapa => {
            milestoneList.appendChild(renderMilestone(objective, etapa));
        });

        const addForm = documentRef.createElement("form");
        addForm.className = "objective-add-milestone";

        const addInput = documentRef.createElement("input");
        addInput.type = "text";
        addInput.maxLength = 200;
        addInput.placeholder = "Adicionar uma etapa";
        addInput.setAttribute(
            "aria-label",
            `Nova etapa do objetivo ${objective.titulo}`
        );
        addInput.disabled = busy;

        const addButton = documentRef.createElement("button");
        addButton.type = "submit";
        addButton.className = "secondary-button";
        addButton.textContent = "+ Etapa";
        addButton.disabled = busy;

        addForm.append(addInput, addButton);
        addForm.addEventListener("submit", async event => {
            event.preventDefault();
            const titulo = addInput.value.trim();

            if (!titulo) {
                addInput.focus();
                return;
            }

            await addMilestone(objective.id, titulo);
        });

        card.append(
            header,
            progressHeader,
            progressBar,
            milestoneList,
            addForm
        );

        return card;
    }

    function render() {

        renderDashboardSummary();

        if (!list) {
            return;
        }

        list.replaceChildren();

        if (objectives.length === 0) {
            const empty = documentRef.createElement("p");
            empty.className = "objective-empty";
            empty.textContent = loaded ?
                "Você ainda não tem objetivos. Crie um para começar a acompanhar seu progresso." :
                "Carregando seus objetivos...";
            list.appendChild(empty);
        } else {
            objectives.forEach(objective => {
                list.appendChild(renderObjective(objective));
            });
        }

        page?.querySelectorAll("button").forEach(button => {
            button.disabled = busy;
        });
    }

    async function mutate(operation, statusMessage = "Salvando objetivo...") {

        if (busy) {
            return false;
        }

        busy = true;
        setStatus(statusMessage);
        render();

        try {
            const result = await operation();
            if (result?.objetivos) {
                objectives = result.objetivos;
            } else if (result?.objetivo) {
                objectives = objectives
                    .filter(objective => objective.id !== result.objetivo.id)
                    .concat(result.objetivo);
            } else if (result?.removidoId) {
                objectives = objectives.filter(
                    objective => objective.id !== result.removidoId
                );
            }

            ordenarObjetivos();
            loaded = true;
            setStatus("");
            return true;
        } catch (erro) {
            setStatus(erro.message, true);
            return false;
        } finally {
            busy = false;
            render();
        }
    }

    async function load() {

        loaded = false;
        render();

        const carregou = await mutate(async () => {
            const result = await request("/api/objetivos");

            if (!Array.isArray(result.objetivos)) {
                throw new Error(
                    "O servidor retornou uma lista de objetivos inválida."
                );
            }

            return result;
        }, "Carregando objetivos...");

        if (!carregou) {
            setStatus(
                statusText?.textContent ||
                    status?.textContent ||
                    "Não foi possível carregar seus objetivos.",
                true,
                true
            );
        }
    }

    async function createObjective(event) {

        event.preventDefault();

        const etapas = (milestonesInput?.value || "")
            .split(/\r?\n/)
            .map(etapa => etapa.trim())
            .filter(Boolean);

        const created = await mutate(async () => {
            const result = await request("/api/objetivos", {
                method: "POST",
                body: JSON.stringify({
                    titulo: titleInput?.value.trim() || "",
                    dataLimite: deadlineInput?.value || null,
                    etapas
                })
            });

            return result;
        });

        if (created) {
            form.reset();
            titleInput?.focus();
        }
    }

    async function updateMilestone(objectiveId, milestoneId, concluida) {

        await mutate(() => request(
            `/api/objetivos/${encodeURIComponent(objectiveId)}/etapas/${encodeURIComponent(milestoneId)}`,
            {
                method: "PATCH",
                body: JSON.stringify({ concluida })
            }
        ));
    }

    async function addMilestone(objectiveId, titulo) {

        await mutate(() => request(
            `/api/objetivos/${encodeURIComponent(objectiveId)}/etapas`,
            {
                method: "POST",
                body: JSON.stringify({ titulo })
            }
        ));
    }

    async function removeMilestone(objectiveId, milestone) {

        if (!confirmAction(`Excluir a etapa "${milestone.titulo}"?`)) {
            return;
        }

        await mutate(() => request(
            `/api/objetivos/${encodeURIComponent(objectiveId)}/etapas/${encodeURIComponent(milestone.id)}`,
            { method: "DELETE" }
        ));
    }

    async function removeObjective(objective) {

        if (!confirmAction(`Excluir o objetivo "${objective.titulo}" e todas as suas etapas?`)) {
            return;
        }

        await mutate(async () => {
            await request(
                `/api/objetivos/${encodeURIComponent(objective.id)}`,
                { method: "DELETE" }
            );

            return {
                removidoId: objective.id
            };
        });
    }

    form?.addEventListener("submit", createObjective);
    retryLoadButton?.addEventListener("click", load);

    return {
        load,
        render,
        setStatus,
        setReturnHandler(handler) {
            returnButton?.addEventListener("click", handler);
        }
    };
}
