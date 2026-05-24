export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";
import { ensureAlertsTable, ensureMonitorsTable } from "@/lib/db-setup";

type DbAlert = {
	id: string;
	monitor_id: string;
	monitor_name: string;
	monitor_url: string;
	status: string;
	started_at: number;
	resolved_at: number | null;
	duration_ms: number | null;
	analysis: string | null;
};

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await ensureAlertsTable();
		await ensureMonitorsTable();

		const res = await tursoExecute(
			dbUrl,
			dbToken,
			`SELECT a.id, a.monitor_id, m.name AS monitor_name, m.url AS monitor_url,
              a.status, a.started_at, a.resolved_at, a.duration_ms, a.analysis
       FROM pw_alerts a
       JOIN pw_monitors m ON m.id = a.monitor_id
       WHERE a.user_id = ?
       ORDER BY a.started_at DESC
       LIMIT 100`,
			[session.user.id],
		);

		return NextResponse.json(
			mapRows<DbAlert>(res).map((a) => ({
				id: a.id,
				monitorId: a.monitor_id,
				monitorName: a.monitor_name,
				monitorUrl: a.monitor_url,
				status: a.status as "ongoing" | "resolved",
				startedAt: new Date(a.started_at).toISOString(),
				resolvedAt: a.resolved_at ? new Date(a.resolved_at).toISOString() : null,
				durationMs: a.duration_ms,
				analysis: a.analysis ?? null,
			})),
		);
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
