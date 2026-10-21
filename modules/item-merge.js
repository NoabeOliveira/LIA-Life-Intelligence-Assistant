function normalizeItem(item) {

    if (!item) {
        return null;
    }

    return {
        id: String(item.id),
        titulo: item.titulo,
        tipo: item.tipo,
        data: item.data ?? null,
        horario: item.horario ?? null,
        concluido: item.concluido === true
    };
}

function sameItem(left, right) {
    return JSON.stringify(normalizeItem(left)) ===
        JSON.stringify(normalizeItem(right));
}

export function threeWayMergeItems(baseItems, localItems, serverItems) {

    const base = new Map(
        baseItems.map(item => [String(item.id), normalizeItem(item)])
    );
    const local = new Map(
        localItems.map(item => [String(item.id), normalizeItem(item)])
    );
    const server = new Map(
        serverItems.map(item => [String(item.id), normalizeItem(item)])
    );
    const ids = new Set([
        ...base.keys(),
        ...local.keys(),
        ...server.keys()
    ]);
    const merged = [];
    const conflicts = [];

    for (const id of ids) {

        const original = base.get(id) ?? null;
        const localItem = local.get(id) ?? null;
        const serverItem = server.get(id) ?? null;
        const localChanged = !sameItem(original, localItem);
        const serverChanged = !sameItem(original, serverItem);

        if (!localChanged) {
            if (serverItem) {
                merged.push(serverItem);
            }
            continue;
        }

        if (!serverChanged || sameItem(localItem, serverItem)) {
            if (localItem) {
                merged.push(localItem);
            }
            continue;
        }

        conflicts.push({
            id,
            base: original,
            local: localItem,
            server: serverItem
        });
    }

    const orderedIds = [...server.keys()];
    local.keys().forEach(id => {
        if (!server.has(id)) {
            orderedIds.push(id);
        }
    });
    const order = new Map(
        orderedIds.map((id, index) => [id, index])
    );

    merged.sort((a, b) => (
        (order.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER)
    ));

    return {
        merged,
        conflicts,
        baseCount: base.size,
        localCount: local.size,
        serverCount: server.size
    };
}

export function applyItemConflictChoices(merge, choices) {

    if (merge.conflicts.some(conflict => (
        choices.get(conflict.id) !== "local" &&
        choices.get(conflict.id) !== "server"
    ))) {
        throw new Error("Escolha uma versão para cada item em conflito.");
    }

    const result = [...merge.merged];

    merge.conflicts.forEach(conflict => {

        const selected = choices.get(conflict.id) === "local" ?
            conflict.local :
            conflict.server;

        if (selected) {
            result.push(selected);
        }
    });

    return result;
}
