import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await requireSession(req);
		const { id } = await params;
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		const res = await tursoExecute(dbUrl, dbToken, "SELECT * FROM pw_monitors WHERE id = ? AND user_id = ?", [
			id,
			session.user.id,
		]);
		const [monitor] = mapRows<DbMonitor>(res);
		if (!monitor) return NextResponse.json({ error: "Not found" }, { status: 404 });
		return NextResponse.json(toApiMonitor(monitor));
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await requireSession(req);
		const { id } = await params;
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await tursoExecute(
			dbUrl,
			dbToken,
			"UPDATE pw_monitors SET enabled = 0, updated_at = ? WHERE id = ? AND user_id = ?",
			[Date.now(), id, session.user.id],
		);
		return NextResponse.json({ ok: true });
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
