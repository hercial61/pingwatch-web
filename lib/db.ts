import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./auth-schema";

type DB = LibSQLDatabase<typeof schema>;

// Lazily instantiate the libsql client. Creating it at import time required
// TURSO_* env vars to be present whenever this module was loaded — which broke
// `next build` page-data collection (routes are imported with no runtime env,
// so `createClient({ url: undefined })` threw URL_INVALID). The client is now
// created on first actual use (request time), when the env is present.
let instance: DB | null = null;

function getDb(): DB {
	if (!instance) {
		instance = drizzle(
			createClient({
				url: process.env.TURSO_DATABASE_URL!,
				authToken: process.env.TURSO_AUTH_TOKEN,
			}),
			{ schema },
		);
	}
	return instance;
}

// Exposed as a Proxy so existing callers (e.g. better-auth's drizzleAdapter,
// which receives `db` at module-construction time) keep working unchanged: the
// underlying client is only built when a property is first accessed at runtime.
export const db = new Proxy({} as DB, {
	get(_target, prop) {
		const real = getDb() as unknown as Record<string | symbol, unknown>;
		const value = real[prop];
		return typeof value === "function" ? value.bind(real) : value;
	},
}) as DB;
