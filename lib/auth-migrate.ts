import { tursoExecute } from "@/lib/turso";

function db() {
	const url = process.env.TURSO_DATABASE_URL;
	const token = process.env.TURSO_AUTH_TOKEN;
	if (!url || !token) throw new Error("DB not configured");
	return { url, token };
}

export async function runAllMigrations() {
	const { url, token } = db();

	// Better Auth tables (SQLite schema)
	const statements = [
		`CREATE TABLE IF NOT EXISTS user (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
		`CREATE TABLE IF NOT EXISTS session (
      id TEXT NOT NULL PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES user(id)
    )`,
		`CREATE TABLE IF NOT EXISTS account (
      id TEXT NOT NULL PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id),
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
		`CREATE TABLE IF NOT EXISTS verification (
      id TEXT NOT NULL PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    )`,
		// App tables
		`CREATE TABLE IF NOT EXISTS pw_monitors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'pending',
      last_checked_at INTEGER,
      last_response_time_ms INTEGER,
      total_checks INTEGER NOT NULL DEFAULT 0,
      successful_checks INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    )`,
		"CREATE INDEX IF NOT EXISTS idx_pw_mon_user ON pw_monitors(user_id)",
		`CREATE TABLE IF NOT EXISTS pw_alerts (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ongoing',
      started_at INTEGER NOT NULL,
      resolved_at INTEGER,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    )`,
		"CREATE INDEX IF NOT EXISTS idx_pw_alerts_monitor ON pw_alerts(monitor_id)",
		"CREATE INDEX IF NOT EXISTS idx_pw_alerts_user ON pw_alerts(user_id)",
		`CREATE TABLE IF NOT EXISTS pw_push_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
		"CREATE INDEX IF NOT EXISTS idx_pw_tokens_user ON pw_push_tokens(user_id)",
	];

	for (const sql of statements) {
		await tursoExecute(url, token, sql);
	}

	// Status pages
	await tursoExecute(
		url,
		token,
		`CREATE TABLE IF NOT EXISTS pw_status_pages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT 'System Status',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
	);
	await tursoExecute(url, token, "CREATE INDEX IF NOT EXISTS idx_pw_sp_slug ON pw_status_pages(slug)");

	// Additive column migrations — idempotent via try/catch
	try {
		await tursoExecute(url, token, "ALTER TABLE pw_alerts ADD COLUMN analysis TEXT");
	} catch {
		// column already exists
	}

	return { ok: true, tables: ["user", "session", "account", "verification", "pw_monitors", "pw_alerts", "pw_push_tokens"] };
}
