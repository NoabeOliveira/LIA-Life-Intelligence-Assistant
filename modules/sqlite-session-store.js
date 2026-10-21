import session from "express-session";
import Database from "better-sqlite3";

export function createSqliteSessionStore(databasePath) {

    const database =
        new Database(databasePath);

    database.pragma("journal_mode = WAL");

    database.exec(`
        CREATE TABLE IF NOT EXISTS lia_sessions (
            session_id TEXT PRIMARY KEY,
            session_data TEXT NOT NULL,
            expires_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS lia_sessions_expires_at_idx
        ON lia_sessions (expires_at);
    `);

    const selectSession =
        database.prepare(`
            SELECT session_data, expires_at
            FROM lia_sessions
            WHERE session_id = ?
        `);

    const upsertSession =
        database.prepare(`
            INSERT INTO lia_sessions (
                session_id,
                session_data,
                expires_at
            ) VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                session_data = excluded.session_data,
                expires_at = excluded.expires_at
        `);

    const updateExpiration =
        database.prepare(`
            UPDATE lia_sessions
            SET expires_at = ?
            WHERE session_id = ?
        `);

    const deleteSession =
        database.prepare(`
            DELETE FROM lia_sessions
            WHERE session_id = ?
        `);

    const deleteExpired =
        database.prepare(`
            DELETE FROM lia_sessions
            WHERE expires_at IS NOT NULL AND expires_at <= ?
        `);

    const store = new session.Store();
    const cleanupTimer = setInterval(
        () => {

            try {
                deleteExpired.run(Date.now());
            } catch (erro) {
                console.error(
                    "Erro ao remover sessões expiradas:",
                    erro
                );
            }
        },
        60 * 60 * 1000
    );

    cleanupTimer.unref();
    deleteExpired.run(Date.now());

    store.get = (sessionId, callback) => {

        try {

            const row =
                selectSession.get(sessionId);

            if (!row) {
                callback(null, null);
                return;
            }

            if (
                row.expires_at !== null &&
                row.expires_at <= Date.now()
            ) {
                deleteSession.run(sessionId);
                callback(null, null);
                return;
            }

            callback(
                null,
                JSON.parse(row.session_data)
            );

        } catch (erro) {
            callback(erro);
        }
    };

    store.set = (sessionId, sessionData, callback = () => {}) => {

        try {

            const expiresAt =
                sessionData.cookie?.expires ?
                    Date.parse(sessionData.cookie.expires) :
                    null;

            upsertSession.run(
                sessionId,
                JSON.stringify(sessionData),
                Number.isFinite(expiresAt) ?
                    expiresAt :
                    null
            );

            callback(null);

        } catch (erro) {
            callback(erro);
        }
    };

    store.destroy = (sessionId, callback = () => {}) => {

        try {
            deleteSession.run(sessionId);
            callback(null);
        } catch (erro) {
            callback(erro);
        }
    };

    store.touch = (sessionId, sessionData, callback = () => {}) => {

        try {

            const expiresAt =
                sessionData.cookie?.expires ?
                    Date.parse(sessionData.cookie.expires) :
                    null;

            updateExpiration.run(
                Number.isFinite(expiresAt) ?
                    expiresAt :
                    null,
                sessionId
            );

            callback(null);

        } catch (erro) {
            callback(erro);
        }
    };

    store.close = () => {
        clearInterval(cleanupTimer);
        database.close();
    };

    return store;
}
