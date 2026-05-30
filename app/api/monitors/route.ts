export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";
import { ensureMonitorsTable, ensureHttpMonitorColumns, ensureHttpAlertColumns } from "@/lib/db-setup";
import crypto from "node:crypto";

type DbMonitor = {
	id: string;
	name: string;
	url: string;
	interval_seconds: number;
	status: string;
	last_checked_at: number | null;
	last_response_time_ms: number | null;
	total_checks: number;
	successful_checks: number;
	created_at: number;
	monitor_type: string;
	http_method: string;
	http_expected_status: number;
	http_timeout_ms: number;
	slack_webhook_url: string | null;
	alert_webhook_url: string | null;
	ssl_expiry_at: number | null;
};

function toApiMonitor(m: DbMonitor) {
	const uptime = m.total_checks > 0 ? (m.successful_checks / m.total_checks) * 100 : 100;
	return {
		id: m.id,
		name: m.name,
		url: m.url,
		interval: m.interval_seconds,
		status: m.status as "up" | "down" | "pending",
		lastCheckedAt: m.last_checked_at ? new Date(m.last_checked_at).toISOString() : null,
		lastResponseTime: m.last_response_time_ms,
		uptime: Math.round(uptime * 100) / 100,
		createdAt: new Date(m.created_at).toISOString(),
		monitorType: (m.monitor_type ?? "heartbeat") as "heartbeat" | "http",
		httpMethod: m.http_method ?? "GET",
		httpExpectedStatus: m.http_expected_status ?? 200,
		httpTimeoutMs: m.http_timeout_ms ?? 10000,
		slackWebhookUrl: m.slack_webhook_url ?? null,
		alertWebhookUrl: m.alert_webhook_url ?? null,
		sslExpiryAt: m.ssl_expiry_at ? new Date(m.ssl_expiry_at).toISOString() : null,
	};
}

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await ensureMonitorsTable();
		await ensureHttpMonitorColumns();
		const res = await tursoExecute(
			dbUrl,
			dbToken,
			"SELECT * FROM pw_monitors WHERE user_id = ? AND enabled = 1 ORDER BY created_at DESC",
			[session.user.id],
		);
		return NextResponse.json(mapRows<DbMonitor>(res).map(toApiMonitor));
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		console.error("GET /api/monitors", e);
		return NextResponse.json({ error: "Could not load monitors. Please try again." }, { status: 500 });
	}
}

function isValidUrl(raw: string): boolean {
	try {
		const u = new URL(raw);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const body = (await req.json()) as {
			name?: string;
			url?: string;
			interval?: number;
			monitorType?: string;
			httpMethod?: string;
			httpExpectedStatus?: number;
			httpTimeoutMs?: number;
			slackWebhookUrl?: string;
			alertWebhookUrl?: string;
		};
		const {
			name,
			url,
			monitorType = "heartbeat",
			httpMethod = "GET",
			httpExpectedStatus = 200,
			httpTimeoutMs = 10000,
			slackWebhookUrl = null,
			alertWebhookUrl = null,
		} = body;
		const interval = body.interval ?? (monitorType === "http" ? 300 : 60);

		if (!name || !url) return NextResponse.json({ error: "name and url are required" }, { status: 400 });
		if (!isValidUrl(url)) return NextResponse.json({ error: "Please enter a valid URL (e.g. https://example.com)" }, { status: 400 });

		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await ensureMonitorsTable();
		await ensureHttpMonitorColumns();
		await ensureHttpAlertColumns();

		const id = crypto.randomUUID();
		const now = Date.now();
		await tursoExecute(
			dbUrl,
			dbToken,
			`INSERT INTO pw_monitors (id, user_id, name, url, interval_seconds, status, monitor_type, http_method, http_expected_status, http_timeout_ms, slack_webhook_url, alert_webhook_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
			[id, session.user.id, name, url, interval, monitorType, httpMethod, httpExpectedStatus, httpTimeoutMs, slackWebhookUrl, alertWebhookUrl, now, now],
		);

		const res = await tursoExecute(dbUrl, dbToken, "SELECT * FROM pw_monitors WHERE id = ?", [id]);
		const [monitor] = mapRows<DbMonitor>(res);
		return NextResponse.json(toApiMonitor(monitor), { status: 201 });
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		console.error("POST /api/monitors", e);
		return NextResponse.json({ error: "Could not add monitor. Please try again." }, { status: 500 });
	}
}
