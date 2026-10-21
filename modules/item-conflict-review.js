import { formatarDataBrasileira } from "./date-utils.js";
import {
    applyItemConflictChoices,
    threeWayMergeItems
} from "./item-merge.js";

export function createItemConflictReview({
    dialog,
    onRefresh,
    onResolve,
    documentRef = document
}) {

    const summary = dialog?.querySelector("#conflictSummary");
    const list = dialog?.querySelector("#conflictItems");
    const confirmButton = dialog?.querySelector("#applyConflictMerge");
    const cancelButton = dialog?.querySelector("#closeConflictReview");
    const refreshButton = dialog?.querySelector("#refreshConflictServer");
    let currentMerge = null;
    let choices = new Map();
    let resolving = false;
    let refreshing = false;
    let errorMessage = "";

    function describeItem(item) {

        if (!item) {
            return "A tarefa foi excluída.";
        }

        const details = [];

        if (item.data) {
            details.push(formatarDataBrasileira(item.data));
        }

        if (item.horario) {
            details.push(item.horario);
        }

        if (item.concluido) {
            details.push("Concluída");
        }

        return [
            item.titulo,
            details.length > 0 ? details.join(" • ") : null
        ].filter(Boolean).join(" — ");
    }

    function createChoiceButton(text, side, conflict) {

        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "conflict-choice";
        button.textContent = text;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
            choices.set(conflict.id, side);
            render();
        });
        return button;
    }

    function render() {

        if (!currentMerge || !list || !summary || !confirmButton) {
            return;
        }

        list.replaceChildren();
        if (!currentMerge.serverAvailable) {
            summary.textContent = errorMessage ||
                "Suas alterações locais estão preservadas. Carregue a versão atual do servidor para comparar as mudanças.";
        } else if (errorMessage) {
            summary.textContent = errorMessage;
        } else {
            summary.textContent = currentMerge.conflicts.length === 0 ?
            "As alterações são compatíveis e podem ser combinadas automaticamente." :
            `As alterações independentes serão combinadas. Escolha qual versão manter nos ${currentMerge.conflicts.length} item(ns) alterado(s) nas duas sessões.`;
        }

        currentMerge.conflicts.forEach(conflict => {

            const card = documentRef.createElement("article");
            card.className = "conflict-item";

            const title = documentRef.createElement("h3");
            title.textContent = conflict.base?.titulo ||
                conflict.local?.titulo ||
                conflict.server?.titulo ||
                "Tarefa";

            const versions = documentRef.createElement("div");
            versions.className = "conflict-versions";

            [
                ["local", "Esta sessão", conflict.local],
                ["server", "Servidor", conflict.server]
            ].forEach(([side, label, item]) => {

                const version = documentRef.createElement("div");
                version.className = "conflict-version";

                const versionLabel = documentRef.createElement("strong");
                versionLabel.textContent = label;

                const description = documentRef.createElement("p");
                description.textContent = describeItem(item);

                const button = createChoiceButton(
                    choices.get(conflict.id) === side ?
                        "Selecionada" :
                        `Manter ${label.toLowerCase()}`,
                    side,
                    conflict
                );

                if (choices.get(conflict.id) === side) {
                    button.setAttribute("aria-pressed", "true");
                    button.classList.add("selected");
                }

                version.append(versionLabel, description, button);
                versions.appendChild(version);
            });

            card.append(title, versions);
            list.appendChild(card);
        });

        const hasAllChoices = currentMerge.serverAvailable &&
            currentMerge.conflicts.every(conflict => (
            choices.has(conflict.id)
        ));
        confirmButton.disabled = resolving || !hasAllChoices;
        confirmButton.textContent = resolving ?
            "Aplicando..." :
            "Aplicar combinação";
        if (refreshButton) {
            refreshButton.hidden = currentMerge.serverAvailable;
            refreshButton.disabled = refreshing;
            refreshButton.textContent = refreshing ?
                "Carregando..." :
                "Carregar versão do servidor";
        }
    }

    async function resolve() {

        if (!currentMerge || resolving) {
            return;
        }

        let mergedItems;

        try {
            mergedItems = applyItemConflictChoices(
                currentMerge,
                choices
            );
        } catch {
            return;
        }

        resolving = true;
        errorMessage = "";
        render();

        try {
            const nextConflict = await onResolve(mergedItems);

            if (nextConflict) {
                show(nextConflict);
                return;
            }

            dialog?.close();
        } catch (erro) {
            errorMessage = erro.message ||
                "Não foi possível salvar a combinação. Suas duas versões continuam preservadas.";
        } finally {
            resolving = false;
            render();
        }
    }

    async function refreshServer() {

        if (refreshing) {
            return;
        }

        refreshing = true;
        errorMessage = "";
        render();

        try {
            show(await onRefresh());
        } catch (erro) {
            errorMessage = erro.message ||
                "Não foi possível carregar a versão do servidor.";
        } finally {
            refreshing = false;
            render();
        }
    }

    function show(conflict) {

        if (
            !Array.isArray(conflict?.base) ||
            !Array.isArray(conflict?.local)
        ) {
            return;
        }

        currentMerge = conflict.server ?
            {
                ...threeWayMergeItems(
                    conflict.base,
                    conflict.local,
                    conflict.server
                ),
                serverAvailable: true
            } :
            {
                merged: [],
                conflicts: [],
                serverAvailable: false
            };
        choices = new Map();
        errorMessage = "";
        render();

        if (dialog?.showModal && !dialog.open) {
            dialog.showModal();
        }

        confirmButton?.focus();
    }

    confirmButton?.addEventListener("click", resolve);
    refreshButton?.addEventListener("click", refreshServer);
    cancelButton?.addEventListener("click", () => dialog?.close());

    return { show };
}
