import Database from "better-sqlite3";
import { criarDataLocal } from "./date-utils.js";

const MAX_ITEMS_PER_USER = 1000;
const MAX_TITLE_LENGTH = 300;

export class ItemRevisionConflictError extends Error {

    constructor(expectedRevision, actualRevision) {
        super("Os itens foram alterados em outra sessão.");
        this.name = "ItemRevisionConflictError";
        this.expectedRevision = expectedRevision;
        this.actualRevision = actualRevision;
    }
}

export function validarItens(itens) {

    if (!Array.isArray(itens)) {
        throw new TypeError("A lista de itens deve ser um array.");
    }

    if (itens.length > MAX_ITEMS_PER_USER) {
        throw new RangeError(
            `O limite é de ${MAX_ITEMS_PER_USER} itens por usuário.`
        );
    }

    return itens.map((item, index) => {

        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new TypeError(`O item na posição ${index} é inválido.`);
        }

        const id = String(item.id ?? "").trim();
        const titulo = String(item.titulo ?? "").trim();

        if (!id || id.length > 100) {
            throw new TypeError(`O item na posição ${index} tem um ID inválido.`);
        }

        if (!titulo || titulo.length > MAX_TITLE_LENGTH) {
            throw new TypeError(`O título do item na posição ${index} é inválido.`);
        }

        if (!["tarefa", "compromisso"].includes(item.tipo)) {
            throw new TypeError(`O tipo do item na posição ${index} é inválido.`);
        }

        if (
            item.data != null &&
            (
                typeof item.data !== "string" ||
                !criarDataLocal(item.data)
            )
        ) {
            throw new TypeError(`A data do item na posição ${index} é inválida.`);
        }

        if (
            item.horario != null &&
            (
                typeof item.horario !== "string" ||
                !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.horario)
            )
        ) {
            throw new TypeError(`O horário do item na posição ${index} é inválido.`);
        }

        return {
            id,
            titulo,
            tipo: item.tipo,
            data: item.data ?? null,
            horario: item.horario ?? null,
            concluido: item.concluido === true
        };
    });
}

export function createItemStore(databasePath) {

    const database = new Database(databasePath);

    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");

    database.exec(`
        CREATE TABLE IF NOT EXISTS user_items (
            user_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('tarefa', 'compromisso')),
            item_date TEXT,
            item_time TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, item_id)
        )
    `);

    database.exec(`
        CREATE TABLE IF NOT EXISTS user_item_revisions (
            user_id TEXT PRIMARY KEY,
            revision INTEGER NOT NULL DEFAULT 0
        )
    `);

    const selectItems = database.prepare(`
        SELECT
            item_id AS id,
            title AS titulo,
            type AS tipo,
            item_date AS data,
            item_time AS horario,
            completed AS concluido
        FROM user_items
        WHERE user_id = ?
        ORDER BY rowid
    `);

    const deleteItems = database.prepare(
        "DELETE FROM user_items WHERE user_id = ?"
    );

    const selectRevision = database.prepare(`
        SELECT revision
        FROM user_item_revisions
        WHERE user_id = ?
    `);

    const upsertRevision = database.prepare(`
        INSERT INTO user_item_revisions (user_id, revision)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision
    `);

    const insertItem = database.prepare(`
        INSERT INTO user_items (
            user_id,
            item_id,
            title,
            type,
            item_date,
            item_time,
            completed
        ) VALUES (
            @user_id,
            @id,
            @titulo,
            @tipo,
            @data,
            @horario,
            @concluido
        )
    `);

    const replaceItemsTransaction = database.transaction(
        (userId, items, expectedRevision) => {

            const currentRevision =
                selectRevision.get(userId)?.revision ?? 0;

            if (
                expectedRevision !== undefined &&
                expectedRevision !== currentRevision
            ) {
                throw new ItemRevisionConflictError(
                    expectedRevision,
                    currentRevision
                );
            }

            deleteItems.run(userId);

            for (const item of items) {
                insertItem.run({
                    user_id: userId,
                    ...item,
                    concluido: item.concluido ? 1 : 0
                });
            }

            const nextRevision = currentRevision + 1;
            upsertRevision.run(userId, nextRevision);
            return nextRevision;
        }
    );

    return {
        list(userId) {

            if (!userId) {
                throw new TypeError("É necessário informar o usuário.");
            }

            return selectItems.all(String(userId)).map(item => ({
                ...item,
                concluido: Boolean(item.concluido)
            }));
        },

        getRevision(userId) {

            if (!userId) {
                throw new TypeError("É necessário informar o usuário.");
            }

            return selectRevision.get(String(userId))?.revision ?? 0;
        },

        replace(userId, items, expectedRevision) {

            if (!userId) {
                throw new TypeError("É necessário informar o usuário.");
            }

            const normalizedItems = validarItens(items);
            const ids = new Set(normalizedItems.map(item => item.id));

            if (ids.size !== normalizedItems.length) {
                throw new TypeError("A lista contém IDs de itens duplicados.");
            }

            replaceItemsTransaction(
                String(userId),
                normalizedItems,
                expectedRevision
            );

            return {
                itens: this.list(userId),
                revision: this.getRevision(userId)
            };
        },

        close() {
            database.close();
        }
    };
}
