import { tursoExecute } from "@/lib/turso";

function db() {
	const url = process.env.TURSO_DATABASE_URL;
	const token = process.env.TURSO_AUTH_TOKEN;
	if (!url || !token) throw new Error("DB not configured");
	return { url, token };
}

export async function ensureMonitorsTable() {
	const { url, token } = db();
	await tursoExecute(
		url,
		token,
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
	);
	await tursoExecute(url, token, "CREATE INDEX IF NOT EXISTS idx_pw_mon_user ON pw_monitors(user_id)");
}

export async function ensureAlertsTable() {
	const { url, token } = db();
	await tursoExecute(
		url,
		token,
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
	);
	await tursoExecute(url, token, "CREATE INDEX IF NOT EXISTS idx_pw_alerts_monitor ON pw_alerts(monitor_id)");
	await tursoExecute(url, token, "CREATE INDEX IF NOT EXISTS idx_pw_alerts_user ON pw_alerts(user_id)");
}

export async function ensureStatusPagesTable() {
	const { url, token } = db();
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
}

export async function ensureAnalysisColumn() {
	const { url, token } = db();
	try {
		await tursoExecute(url, token, "ALTER TABLE pw_alerts ADD COLUMN analysis TEXT");
	} catch {
		// column already exists
	}
}

export async function ensurePushTokensTable() {
	const { url, token } = db();
	await tursoExecute(
		url,
		token,
		`CREATE TABLE IF NOT EXISTS pw_push_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
	);
	await tursoExecute(url, token, "CREATE INDEX IF NOT EXISTS idx_pw_tokens_user ON pw_push_tokens(user_id)");
}

export async function ensureHttpMonitorColumns() {
	const { url, token } = db();
	const ddls = [
		"ALTER TABLE pw_monitors ADD COLUMN monitor_type TEXT NOT NULL DEFAULT 'heartbeat'",
		"ALTER TABLE pw_monitors ADD COLUMN http_method TEXT NOT NULL DEFAULT 'GET'",
		"ALTER TABLE pw_monitors ADD COLUMN http_expected_status INTEGER NOT NULL DEFAULT 200",
		"ALTER TABLE pw_monitors ADD COLUMN http_timeout_ms INTEGER NOT NULL DEFAULT 10000",
	];
	for (const ddl of ddls) {
		try {
			await tursoExecute(url, token, ddl);
		} catch {
			// column already exists
		}
	}
}

export async function ensureHttpCheckResultsTable() {
	const { url, token } = db();
	await tursoExecute(
		url,
		token,
		`CREATE TABLE IF NOT EXISTS pw_http_check_results (
      id TEXT PRIMARY KEY,
      monitor_id TEXT NOT NULL,
      status TEXT NOT NULL,
      response_time_ms INTEGER,
      status_code INTEGER,
      checked_at INTEGER NOT NULL
    )`,
	);
	await tursoExecute(url, token, "CREATE INDEX IF NOT EXISTS idx_pw_http_cr_monitor ON pw_http_check_results(monitor_id, checked_at)");
}

export async function ensureHttpAlertColumns() {
	const { url, token } = db();
	const ddls = [
		"ALTER TABLE pw_monitors ADD COLUMN slack_webhook_url TEXT",
		"ALTER TABLE pw_monitors ADD COLUMN alert_webhook_url TEXT",
		"ALTER TABLE pw_monitors ADD COLUMN ssl_expiry_at INTEGER",
	];
	for (const ddl of ddls) {
		try {
			await tursoExecute(url, token, ddl);
		} catch {
			// column already exists
		}
	}
}

export async function ensureAlertTypeColumn() {
	const { url, token } = db();
	try {
		await tursoExecute(url, token, "ALTER TABLE pw_alerts ADD COLUMN alert_type TEXT DEFAULT 'downtime'");
	} catch {
		// column already exists
	}
}
