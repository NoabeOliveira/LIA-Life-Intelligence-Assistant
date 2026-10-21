import Database from "better-sqlite3";

export function createSqliteUsageLimiter(databasePath) {

    const database = new Database(databasePath);

    database.pragma("journal_mode = WAL");

    database.exec(`
        CREATE TABLE IF NOT EXISTS api_usage_windows (
            user_id TEXT NOT NULL,
            route TEXT NOT NULL,
            window_start INTEGER NOT NULL,
            request_count INTEGER NOT NULL,
            PRIMARY KEY (user_id, route)
        );

        CREATE TABLE IF NOT EXISTS api_global_usage_windows (
            route TEXT NOT NULL PRIMARY KEY,
            window_start INTEGER NOT NULL,
            request_count INTEGER NOT NULL
        )
    `);

    const selectWindow = database.prepare(`
        SELECT window_start, request_count
        FROM api_usage_windows
        WHERE user_id = ? AND route = ?
    `);

    const upsertWindow = database.prepare(`
        INSERT INTO api_usage_windows (
            user_id,
            route,
            window_start,
            request_count
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, route) DO UPDATE SET
            window_start = excluded.window_start,
            request_count = excluded.request_count
    `);

    const selectGlobalWindow = database.prepare(`
        SELECT window_start, request_count
        FROM api_global_usage_windows
        WHERE route = ?
    `);

    const upsertGlobalWindow = database.prepare(`
        INSERT INTO api_global_usage_windows (
            route,
            window_start,
            request_count
        ) VALUES (?, ?, ?)
        ON CONFLICT(route) DO UPDATE SET
            window_start = excluded.window_start,
            request_count = excluded.request_count
    `);

    const consumeTransaction = database.transaction(
        (userId, route, limit, windowMs, now) => {

            const windowStart =
                Math.floor(now / windowMs) * windowMs;
            const current =
                selectWindow.get(userId, route);
            const requestCount =
                current?.window_start === windowStart ?
                    current.request_count + 1 :
                    1;

            upsertWindow.run(
                userId,
                route,
                windowStart,
                requestCount
            );

            return {
                allowed: requestCount <= limit,
                retryAfterSeconds: Math.max(
                    1,
                    Math.ceil(
                        (windowStart + windowMs - now) / 1000
                    )
                ),
                remaining: Math.max(0, limit - requestCount)
            };
        }
    );

    const consumeWithGlobalTransaction = database.transaction(
        (
            userId,
            route,
            userLimit,
            userWindowMs,
            globalLimit,
            globalWindowMs,
            now
        ) => {

            const userWindowStart =
                Math.floor(now / userWindowMs) * userWindowMs;
            const currentUserWindow =
                selectWindow.get(userId, route);
            const userRequestCount =
                currentUserWindow?.window_start === userWindowStart ?
                    currentUserWindow.request_count + 1 :
                    1;
            const userAllowed =
                userRequestCount <= userLimit;

            upsertWindow.run(
                userId,
                route,
                userWindowStart,
                userRequestCount
            );

            if (!userAllowed) {
                return {
                    allowed: false,
                    scope: "user",
                    retryAfterSeconds: Math.max(
                        1,
                        Math.ceil(
                            (userWindowStart + userWindowMs - now) / 1000
                        )
                    ),
                    remaining: 0
                };
            }

            const globalWindowStart =
                Math.floor(now / globalWindowMs) * globalWindowMs;
            const currentGlobalWindow =
                selectGlobalWindow.get(route);
            const globalRequestCount =
                currentGlobalWindow?.window_start === globalWindowStart ?
                    currentGlobalWindow.request_count + 1 :
                    1;
            const globalAllowed =
                globalRequestCount <= globalLimit;

            upsertGlobalWindow.run(
                route,
                globalWindowStart,
                globalRequestCount
            );

            return {
                allowed: globalAllowed,
                scope: globalAllowed ? null : "global",
                retryAfterSeconds: Math.max(
                    1,
                    Math.ceil(
                        (globalWindowStart + globalWindowMs - now) / 1000
                    )
                ),
                remaining: Math.min(
                    Math.max(0, userLimit - userRequestCount),
                    Math.max(0, globalLimit - globalRequestCount)
                )
            };
        }
    );

    return {
        consume(userId, route, limit, windowMs, now = Date.now()) {

            if (
                userId === undefined ||
                userId === null ||
                !route
            ) {
                throw new TypeError("Usuário e rota são obrigatórios.");
            }

            if (
                !Number.isInteger(limit) ||
                limit < 1 ||
                !Number.isInteger(windowMs) ||
                windowMs < 1 ||
                !Number.isFinite(now)
            ) {
                throw new TypeError("Os parâmetros do limite de uso são inválidos.");
            }

            return consumeTransaction.immediate(
                String(userId),
                String(route),
                limit,
                windowMs,
                now
            );
        },
        consumeWithGlobal(
            userId,
            route,
            userLimit,
            userWindowMs,
            globalLimit,
            globalWindowMs,
            now = Date.now()
        ) {

            if (
                userId === undefined ||
                userId === null ||
                !route
            ) {
                throw new TypeError("Usuário e rota são obrigatórios.");
            }

            if (
                !Number.isInteger(userLimit) ||
                userLimit < 1 ||
                !Number.isInteger(userWindowMs) ||
                userWindowMs < 1 ||
                !Number.isInteger(globalLimit) ||
                globalLimit < 1 ||
                !Number.isInteger(globalWindowMs) ||
                globalWindowMs < 1 ||
                !Number.isFinite(now)
            ) {
                throw new TypeError("Os parâmetros do limite de uso são inválidos.");
            }

            return consumeWithGlobalTransaction.immediate(
                String(userId),
                String(route),
                userLimit,
                userWindowMs,
                globalLimit,
                globalWindowMs,
                now
            );
        },
        close() {
            database.close();
        }
    };
}
