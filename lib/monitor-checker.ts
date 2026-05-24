import Anthropic from "@anthropic-ai/sdk";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";
import { ensureMonitorsTable, ensureAlertsTable, ensureAnalysisColumn } from "@/lib/db-setup";
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

export async function runChecks(dbUrl: string, dbToken: string): Promise<{ checked: number; errors: number }> {
	await ensureMonitorsTable();
	await ensureAlertsTable();
	await ensureAnalysisColumn();

	const res = await tursoExecute(dbUrl, dbToken, "SELECT * FROM pw_monitors WHERE enabled = 1");
	const monitors = mapRows<DbMonitor>(res);

	const sendPush = await getExpo();
	let errors = 0;

	await Promise.all(
		monitors.map(async (monitor) => {
			const now = Date.now();
			let ok = false;
			let responseMs: number | null = null;
			let httpStatus: number | null = null;
			let timedOut = false;

			try {
				const start = Date.now();
				const r = await fetch(monitor.url, { method: "GET", signal: AbortSignal.timeout(10_000) });
				responseMs = Date.now() - start;
				httpStatus = r.status;
				ok = r.status >= 200 && r.status < 400;
			} catch (err) {
				ok = false;
				timedOut = (err as Error)?.name === "TimeoutError";
				errors++;
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
					"INSERT INTO pw_alerts (id, monitor_id, user_id, status, started_at, created_at) VALUES (?, ?, ?, 'ongoing', ?, ?)",
					[alertId, monitor.id, monitor.user_id, now, now],
				);
				void analyzeOutage(dbUrl, dbToken, alertId, monitor.name, monitor.url, httpStatus, timedOut);
				const [tokens, email] = await Promise.all([
					getPushTokens(dbUrl, dbToken, monitor.user_id),
					getUserEmail(dbUrl, dbToken, monitor.user_id),
				]);
				await sendPush(tokens, `${monitor.name} is DOWN`, `${monitor.url} is not responding.`);
				if (email) void sendDownAlert(email, monitor.name, monitor.url, now);
			}

			// State transition: recovery event
			if (prevStatus === "down" && newStatus === "up") {
				const alertRes = await tursoExecute(
					dbUrl,
					dbToken,
					"SELECT id, started_at FROM pw_alerts WHERE monitor_id = ? AND status = 'ongoing' ORDER BY started_at DESC LIMIT 1",
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
			}
		}),
	);

	return { checked: monitors.length, errors };
}
