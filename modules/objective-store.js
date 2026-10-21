import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { criarDataLocal } from "./date-utils.js";

const MAX_OBJECTIVES_PER_USER = 100;
const MAX_MILESTONES_PER_OBJECTIVE = 30;
const MAX_TITLE_LENGTH = 200;

function validarTitulo(titulo, descricao = "O título") {

    if (typeof titulo !== "string") {
        throw new TypeError(`${descricao} é obrigatório.`);
    }

    const normalized = titulo.trim();

    if (!normalized || normalized.length > MAX_TITLE_LENGTH) {
        throw new TypeError(
            `${descricao} deve ter entre 1 e ${MAX_TITLE_LENGTH} caracteres.`
        );
    }

    return normalized;
}

function validarDataLimite(dataLimite) {

    if (dataLimite == null || dataLimite === "") {
        return null;
    }

    if (
        typeof dataLimite !== "string" ||
        !criarDataLocal(dataLimite)
    ) {
        throw new TypeError("A data limite do objetivo é inválida.");
    }

    return dataLimite;
}

function validarEtapas(etapas) {

    if (
        !Array.isArray(etapas) ||
        etapas.length < 1 ||
        etapas.length > MAX_MILESTONES_PER_OBJECTIVE
    ) {
        throw new TypeError(
            `Adicione entre 1 e ${MAX_MILESTONES_PER_OBJECTIVE} etapas ao objetivo.`
        );
    }

    return etapas.map((etapa, index) => ({
        id: randomUUID(),
        titulo: validarTitulo(etapa, `O título da etapa ${index + 1}`)
    }));
}

export function createObjectiveStore(databasePath) {

    const database = new Database(databasePath);

    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");

    database.exec(`
        CREATE TABLE IF NOT EXISTS objectives (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            target_date TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS objectives_user_id_idx
        ON objectives (user_id, created_at);

        CREATE TABLE IF NOT EXISTS objective_milestones (
            id TEXT PRIMARY KEY,
            objective_id TEXT NOT NULL,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            position INTEGER NOT NULL,
            FOREIGN KEY (objective_id)
                REFERENCES objectives (id)
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS objective_milestones_objective_idx
        ON objective_milestones (objective_id, position);
    `);

    const selectObjectives = database.prepare(`
        SELECT id, title, target_date AS dataLimite, created_at AS criadoEm
        FROM objectives
        WHERE user_id = ?
        ORDER BY
            CASE WHEN target_date IS NULL THEN 1 ELSE 0 END,
            target_date,
            created_at
    `);

    const selectMilestones = database.prepare(`
        SELECT
            milestone.id,
            milestone.objective_id AS objetivoId,
            milestone.title AS titulo,
            milestone.completed AS concluida,
            milestone.position AS posicao
        FROM objective_milestones AS milestone
        INNER JOIN objectives AS objective
            ON objective.id = milestone.objective_id
        WHERE objective.user_id = ?
        ORDER BY milestone.objective_id, milestone.position
    `);

    const countObjectives = database.prepare(
        "SELECT COUNT(*) AS total FROM objectives WHERE user_id = ?"
    );

    const countMilestones = database.prepare(`
        SELECT COUNT(*) AS total
        FROM objective_milestones
        WHERE objective_id = ?
    `);

    const insertObjective = database.prepare(`
        INSERT INTO objectives (id, user_id, title, target_date, created_at)
        VALUES (?, ?, ?, ?, ?)
    `);

    const insertMilestone = database.prepare(`
        INSERT INTO objective_milestones (
            id,
            objective_id,
            title,
            completed,
            position
        ) VALUES (?, ?, ?, 0, ?)
    `);

    const findObjective = database.prepare(`
        SELECT id
        FROM objectives
        WHERE id = ? AND user_id = ?
    `);

    const findMilestoneOwner = database.prepare(`
        SELECT objective.id
        FROM objective_milestones AS milestone
        INNER JOIN objectives AS objective
            ON objective.id = milestone.objective_id
        WHERE milestone.id = ? AND objective.id = ? AND objective.user_id = ?
    `);

    const updateMilestone = database.prepare(`
        UPDATE objective_milestones
        SET completed = ?
        WHERE id = ? AND objective_id = ?
    `);

    const deleteMilestoneStatement = database.prepare(`
        DELETE FROM objective_milestones
        WHERE id = ? AND objective_id = ?
    `);

    const selectObjectiveMilestones = database.prepare(`
        SELECT id
        FROM objective_milestones
        WHERE objective_id = ?
        ORDER BY position
    `);

    const updateMilestonePosition = database.prepare(`
        UPDATE objective_milestones
        SET position = ?
        WHERE id = ?
    `);

    const deleteObjectiveStatement = database.prepare(`
        DELETE FROM objectives
        WHERE id = ? AND user_id = ?
    `);

    const deleteMilestoneTransaction = database.transaction(
        (objectiveId, milestoneId) => {
            if (countMilestones.get(objectiveId).total <= 1) {
                throw new RangeError(
                    "Todo objetivo deve manter pelo menos uma etapa."
                );
            }

            deleteMilestoneStatement.run(milestoneId, objectiveId);

            selectObjectiveMilestones.all(objectiveId)
                .forEach((milestone, index) => {
                    updateMilestonePosition.run(index, milestone.id);
                });
        }
    );

    const insertObjectiveTransaction = database.transaction(
        (userId, objective) => {

            const total =
                countObjectives.get(userId).total;

            if (total >= MAX_OBJECTIVES_PER_USER) {
                throw new RangeError(
                    `O limite é de ${MAX_OBJECTIVES_PER_USER} objetivos por conta.`
                );
            }

            const id = randomUUID();
            const createdAt = new Date().toISOString();

            insertObjective.run(
                id,
                userId,
                objective.titulo,
                objective.dataLimite,
                createdAt
            );

            objective.etapas.forEach((etapa, index) => {
                insertMilestone.run(
                    etapa.id,
                    id,
                    etapa.titulo,
                    index
                );
            });

            return id;
        }
    );

    const addMilestoneTransaction = database.transaction(
        (objectiveId, milestoneTitle) => {

            const total =
                countMilestones.get(objectiveId).total;

            if (total >= MAX_MILESTONES_PER_OBJECTIVE) {
                throw new RangeError(
                    `O limite é de ${MAX_MILESTONES_PER_OBJECTIVE} etapas por objetivo.`
                );
            }

            const id = randomUUID();
            insertMilestone.run(
                id,
                objectiveId,
                milestoneTitle,
                total
            );
            return id;
        }
    );

    function formatObjectiveRows(userId) {

        const objectives =
            selectObjectives.all(String(userId));
        const milestones =
            selectMilestones.all(String(userId));
        const byObjective = new Map();

        milestones.forEach(milestone => {

            if (!byObjective.has(milestone.objetivoId)) {
                byObjective.set(milestone.objetivoId, []);
            }

            byObjective.get(milestone.objetivoId).push({
                id: milestone.id,
                titulo: milestone.titulo,
                concluida: Boolean(milestone.concluida)
            });
        });

        return objectives.map(objective => {

            const etapas =
                byObjective.get(objective.id) || [];
            const concluidas =
                etapas.filter(etapa => etapa.concluida).length;

            return {
                id: objective.id,
                titulo: objective.title,
                dataLimite: objective.dataLimite,
                criadoEm: objective.criadoEm,
                etapas,
                progresso: etapas.length === 0 ?
                    0 :
                    Math.round(concluidas / etapas.length * 100)
            };
        });
    }

    return {
        list(userId) {

            if (!userId) {
                throw new TypeError("É necessário informar o usuário.");
            }

            return formatObjectiveRows(userId);
        },

        create(userId, input) {

            if (!userId) {
                throw new TypeError("É necessário informar o usuário.");
            }

            if (!input || typeof input !== "object" || Array.isArray(input)) {
                throw new TypeError("Os dados do objetivo são inválidos.");
            }

            const objective = {
                titulo: validarTitulo(input.titulo),
                dataLimite: validarDataLimite(input.dataLimite),
                etapas: validarEtapas(input.etapas)
            };

            const id = insertObjectiveTransaction(
                String(userId),
                objective
            );

            return formatObjectiveRows(userId)
                .find(item => item.id === id);
        },

        addMilestone(userId, objectiveId, title) {

            if (!findObjective.get(objectiveId, String(userId))) {
                return null;
            }

            addMilestoneTransaction(
                objectiveId,
                validarTitulo(title, "O título da etapa")
            );

            return formatObjectiveRows(userId)
                .find(item => item.id === objectiveId);
        },

        setMilestoneCompleted(userId, objectiveId, milestoneId, completed) {

            if (typeof completed !== "boolean") {
                throw new TypeError("O estado da etapa é inválido.");
            }

            if (!findMilestoneOwner.get(
                milestoneId,
                objectiveId,
                String(userId)
            )) {
                return null;
            }

            updateMilestone.run(
                completed ? 1 : 0,
                milestoneId,
                objectiveId
            );

            return formatObjectiveRows(userId)
                .find(item => item.id === objectiveId);
        },

        deleteMilestone(userId, objectiveId, milestoneId) {

            if (!findMilestoneOwner.get(
                milestoneId,
                objectiveId,
                String(userId)
            )) {
                return null;
            }

            deleteMilestoneTransaction(objectiveId, milestoneId);

            return formatObjectiveRows(userId)
                .find(item => item.id === objectiveId);
        },

        delete(userId, objectiveId) {

            if (!userId) {
                throw new TypeError("É necessário informar o usuário.");
            }

            return deleteObjectiveStatement.run(
                objectiveId,
                String(userId)
            ).changes > 0;
        },

        close() {
            database.close();
        }
    };
}
