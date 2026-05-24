import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";
import { ensureMonitorsTable } from "@/lib/db-setup";
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
	};
}

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await ensureMonitorsTable();
		const res = await tursoExecute(
			dbUrl,
			dbToken,
			"SELECT * FROM pw_monitors WHERE user_id = ? AND enabled = 1 ORDER BY created_at DESC",
			[session.user.id],
		);
		return NextResponse.json(mapRows<DbMonitor>(res).map(toApiMonitor));
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const body = (await req.json()) as { name?: string; url?: string; interval?: number };
		const { name, url, interval = 60 } = body;

		if (!name || !url) return NextResponse.json({ error: "name and url are required" }, { status: 400 });

		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await ensureMonitorsTable();

		const id = crypto.randomUUID();
		const now = Date.now();
		await tursoExecute(
			dbUrl,
			dbToken,
			`INSERT INTO pw_monitors (id, user_id, name, url, interval_seconds, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
			[id, session.user.id, name, url, interval, now, now],
		);

		const res = await tursoExecute(dbUrl, dbToken, "SELECT * FROM pw_monitors WHERE id = ?", [id]);
		const [monitor] = mapRows<DbMonitor>(res);
		return NextResponse.json(toApiMonitor(monitor), { status: 201 });
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
