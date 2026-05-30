import Anthropic from "@anthropic-ai/sdk";
import tls from "node:tls";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";
import { ensureMonitorsTable, ensureAlertsTable, ensureAnalysisColumn, ensureHttpMonitorColumns, ensureHttpCheckResultsTable, ensureHttpAlertColumns, ensureAlertTypeColumn } from "@/lib/db-setup";
import { sendDownAlert, sendUpAlert } from "@/lib/email";
import crypto from "node:crypto";

type DbMonitor = {
	id: string;
	user_id: string;
	name: string;
	url: string;
	interval_seconds: number;
	status: string;
	last_checked_at: number | null;
	last_response_time_ms: number | null;
	total_checks: number;
	successful_checks: number;
	enabled: number;
	monitor_type: string;
	http_method: string;
	http_expected_status: number;
	http_timeout_ms: number;
	slack_webhook_url: string | null;
	alert_webhook_url: string | null;
	ssl_expiry_at: number | null;
};

async function getExpo(): Promise<(tokens: string[], title: string, body: string) => Promise<void>> {
	return async (tokens, title, body) => {
		if (!tokens.length) return;
		await fetch("https://exp.host/--/api/v2/push/send", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(
				tokens.map((to) => ({ to, title, body, sound: "default" })),
			),
		});
	};
}

async function checkSSLExpiry(urlStr: string): Promise<number | null> {
	try {
		const u = new URL(urlStr);
		if (u.protocol !== "https:") return null;
		const host = u.hostname;
		const port = u.port ? parseInt(u.port, 10) : 443;
		return new Promise((resolve) => {
			const socket = tls.connect({ host, port, servername: host }, () => {
				const cert = socket.getPeerCertificate();
				socket.destroy();
				if (!cert?.valid_to) { resolve(null); return; }
				resolve(new Date(cert.valid_to).getTime());
			});
			socket.on("error", () => resolve(null));
			socket.setTimeout(5000, () => { socket.destroy(); resolve(null); });
		});
	} catch {
		return null;
	}
}

async function sendSlackAlert(webhookUrl: string, text: string): Promise<void> {
	try {
		await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
		});
	} catch {
		// fire-and-forget
	}
}

async function sendWebhookAlert(webhookUrl: string, payload: object): Promise<void> {
	try {
		await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	} catch {
		// fire-and-forget
	}
}

async function analyzeOutage(
	dbUrl: string,
	dbToken: string,
	alertId: string,
	monitorName: string,
	monitorUrl: string,
	httpStatus: number | null,
	timedOut: boolean,
): Promise<void> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) return;

	const failure = timedOut
		? "connection timed out"
		: httpStatus
			? `HTTP ${httpStatus}`
			: "connection refused";

	try {
		const client = new Anthropic({ apiKey });
		const msg = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 80,
			system: "You are a site reliability assistant. Respond with exactly one sentence explaining the most likely cause of the outage.",
			messages: [{ role: "user", content: `Monitor: ${monitorName}\nURL: ${monitorUrl}\nFailure: ${failure}` }],
		});
		const analysis = (msg.content[0] as { type: string; text: string }).text?.trim();
		if (analysis) {
			await tursoExecute(dbUrl, dbToken, "UPDATE pw_alerts SET analysis = ? WHERE id = ?", [analysis, alertId]);
		}
	} catch {
		// analysis is best-effort; never block alerts
	}
}

async function getUserEmail(dbUrl: string, dbToken: string, userId: string): Promise<string | null> {
	try {
		const res = await tursoExecute(dbUrl, dbToken, "SELECT email FROM user WHERE id = ?", [userId]);
		const [row] = mapRows<{ email: string }>(res);
		return row?.email ?? null;
	} catch {
		return null;
	}
}

async function getPushTokens(dbUrl: string, dbToken: string, userId: string): Promise<string[]> {
	try {
		const res = await tursoExecute(dbUrl, dbToken, "SELECT token FROM pw_push_tokens WHERE user_id = ?", [userId]);
		return mapRows<{ token: string }>(res).map((r) => r.token);
	} catch {
		return [];
	}
}

export async function runChecks(dbUrl: string, dbToken: string): Promise<{ checked: number; errors: number; total: number }> {
	await ensureMonitorsTable();
	await ensureAlertsTable();
	await ensureAnalysisColumn();
	await ensureHttpMonitorColumns();
	await ensureHttpCheckResultsTable();
	await ensureHttpAlertColumns();
	await ensureAlertTypeColumn();

	const res = await tursoExecute(dbUrl, dbToken, "SELECT * FROM pw_monitors WHERE enabled = 1");
	const allMonitors = mapRows<DbMonitor>(res);

	const nowFilter = Date.now();
	const monitors = allMonitors.filter(
		(m) => m.last_checked_at === null || nowFilter - m.last_checked_at >= m.interval_seconds * 1000,
	);

	const sendPush = await getExpo();
	let errors = 0;

	await Promise.all(
		monitors.map(async (monitor) => {
			const now = Date.now();
			let ok = false;
			let responseMs: number | null = null;
			let httpStatus: number | null = null;
			let timedOut = false;
			const isHttp = monitor.monitor_type === "http";

			try {
				const method = isHttp ? monitor.http_method : "GET";
				const timeoutMs = isHttp ? monitor.http_timeout_ms : 10_000;
				const start = Date.now();
				const r = await fetch(monitor.url, { method, signal: AbortSignal.timeout(timeoutMs) });
				responseMs = Date.now() - start;
				httpStatus = r.status;
				ok = isHttp ? r.status === monitor.http_expected_status : r.status >= 200 && r.status < 400;
			} catch (err) {
				ok = false;
				timedOut = (err as Error)?.name === "TimeoutError";
				errors++;
			}

			if (isHttp) {
				await tursoExecute(
					dbUrl,
					dbToken,
					"INSERT INTO pw_http_check_results (id, monitor_id, status, response_time_ms, status_code, checked_at) VALUES (?, ?, ?, ?, ?, ?)",
					[crypto.randomUUID(), monitor.id, ok ? "up" : "down", responseMs, httpStatus, now],
				);
			}

			const newStatus = ok ? "up" : "down";
			const prevStatus = monitor.status;
			const totalChecks = monitor.total_checks + 1;
			const successfulChecks = monitor.successful_checks + (ok ? 1 : 0);

			await tursoExecute(
				dbUrl,
				dbToken,
				`UPDATE pw_monitors SET status = ?, last_checked_at = ?, last_response_time_ms = ?,
         total_checks = ?, successful_checks = ?, updated_at = ? WHERE id = ?`,
				[newStatus, now, responseMs, totalChecks, successfulChecks, now, monitor.id],
			);

			// State transition: down event
			if (prevStatus !== "down" && newStatus === "down") {
				const alertId = crypto.randomUUID();
				await tursoExecute(
					dbUrl,
					dbToken,
					"INSERT INTO pw_alerts (id, monitor_id, user_id, status, alert_type, started_at, created_at) VALUES (?, ?, ?, 'ongoing', 'downtime', ?, ?)",
					[alertId, monitor.id, monitor.user_id, now, now],
				);
				void analyzeOutage(dbUrl, dbToken, alertId, monitor.name, monitor.url, httpStatus, timedOut);
				const [tokens, email] = await Promise.all([
					getPushTokens(dbUrl, dbToken, monitor.user_id),
					getUserEmail(dbUrl, dbToken, monitor.user_id),
				]);
				await sendPush(tokens, `${monitor.name} is DOWN`, `${monitor.url} is not responding.`);
				if (email) void sendDownAlert(email, monitor.name, monitor.url, now);
				if (monitor.slack_webhook_url) void sendSlackAlert(monitor.slack_webhook_url, `*${monitor.name} is DOWN* — ${monitor.url} is not responding.`);
				if (monitor.alert_webhook_url) void sendWebhookAlert(monitor.alert_webhook_url, { monitor: { id: monitor.id, name: monitor.name, url: monitor.url }, alert: { type: "downtime", status: "down", startedAt: now } });
			}

			// State transition: recovery event
			if (prevStatus === "down" && newStatus === "up") {
				const alertRes = await tursoExecute(
					dbUrl,
					dbToken,
					"SELECT id, started_at FROM pw_alerts WHERE monitor_id = ? AND status = 'ongoing' AND alert_type = 'downtime' ORDER BY started_at DESC LIMIT 1",
					[monitor.id],
				);
				const [ongoing] = mapRows<{ id: string; started_at: number }>(alertRes);
				let durationMs: number | null = null;
				if (ongoing) {
					durationMs = now - ongoing.started_at;
					await tursoExecute(
						dbUrl,
						dbToken,
						"UPDATE pw_alerts SET status = 'resolved', resolved_at = ?, duration_ms = ? WHERE id = ?",
						[now, durationMs, ongoing.id],
					);
				}
				const [tokens, email] = await Promise.all([
					getPushTokens(dbUrl, dbToken, monitor.user_id),
					getUserEmail(dbUrl, dbToken, monitor.user_id),
				]);
				await sendPush(tokens, `${monitor.name} recovered`, `${monitor.url} is back up.`);
				if (email) void sendUpAlert(email, monitor.name, monitor.url, now, durationMs);
				if (monitor.slack_webhook_url) void sendSlackAlert(monitor.slack_webhook_url, `*${monitor.name} recovered* — ${monitor.url} is back up.`);
				if (monitor.alert_webhook_url) void sendWebhookAlert(monitor.alert_webhook_url, { monitor: { id: monitor.id, name: monitor.name, url: monitor.url }, alert: { type: "downtime", status: "up", startedAt: now, durationMs } });
			}

			// SSL expiry check for HTTPS monitors
			if (isHttp) {
				const sslExpiry = await checkSSLExpiry(monitor.url);
				if (sslExpiry !== null) {
					await tursoExecute(dbUrl, dbToken, "UPDATE pw_monitors SET ssl_expiry_at = ? WHERE id = ?", [sslExpiry, monitor.id]);
					const daysLeft = (sslExpiry - now) / (1000 * 60 * 60 * 24);
					const sslAlertType = daysLeft <= 7 ? "ssl_critical" : daysLeft <= 14 ? "ssl_warning" : null;

					if (sslAlertType) {
						const existing = await tursoExecute(
							dbUrl, dbToken,
							"SELECT id FROM pw_alerts WHERE monitor_id = ? AND alert_type = ? AND status = 'ongoing' LIMIT 1",
							[monitor.id, sslAlertType],
						);
						if (mapRows(existing).length === 0) {
							await tursoExecute(
								dbUrl, dbToken,
								"INSERT INTO pw_alerts (id, monitor_id, user_id, status, alert_type, started_at, created_at) VALUES (?, ?, ?, 'ongoing', ?, ?, ?)",
								[crypto.randomUUID(), monitor.id, monitor.user_id, sslAlertType, now, now],
							);
						}
					} else {
						await tursoExecute(
							dbUrl, dbToken,
							"UPDATE pw_alerts SET status = 'resolved', resolved_at = ? WHERE monitor_id = ? AND alert_type IN ('ssl_warning', 'ssl_critical') AND status = 'ongoing'",
							[now, monitor.id],
						);
					}
				}
			}
		}),
	);

	return { checked: monitors.length, errors, total: allMonitors.length };
}
