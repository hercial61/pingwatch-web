export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";
import { ensureStatusPagesTable, ensureMonitorsTable, ensureAlertsTable } from "@/lib/db-setup";

type DbPage = { user_id: string; title: string };
type DbMonitor = { id: string; name: string; url: string; status: string; last_response_time_ms: number | null; total_checks: number; successful_checks: number };
type DbAlert = { id: string; monitor_name: string; status: string; started_at: number; resolved_at: number | null; duration_ms: number | null };

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ slug: string }> },
) {
	try {
		const { slug } = await params;
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await Promise.all([ensureStatusPagesTable(), ensureMonitorsTable(), ensureAlertsTable()]);

		const pageRes = await tursoExecute(dbUrl, dbToken,
			"SELECT user_id, title FROM pw_status_pages WHERE slug = ?", [slug]);
		const [page] = mapRows<DbPage>(pageRes);
		if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

		const [monitorsRes, alertsRes] = await Promise.all([
			tursoExecute(dbUrl, dbToken,
				"SELECT id, name, url, status, last_response_time_ms, total_checks, successful_checks FROM pw_monitors WHERE user_id = ? AND enabled = 1 ORDER BY created_at ASC",
				[page.user_id]),
			tursoExecute(dbUrl, dbToken,
				`SELECT a.id, m.name AS monitor_name, a.status, a.started_at, a.resolved_at, a.duration_ms
         FROM pw_alerts a JOIN pw_monitors m ON m.id = a.monitor_id
         WHERE a.user_id = ? AND a.started_at > ?
         ORDER BY a.started_at DESC LIMIT 20`,
				[page.user_id, Date.now() - 30 * 24 * 60 * 60 * 1000]),
		]);

		const monitors = mapRows<DbMonitor>(monitorsRes).map((m) => ({
			name: m.name,
			url: m.url,
			status: m.status,
			lastResponseTime: m.last_response_time_ms,
			uptime: m.total_checks > 0 ? (m.successful_checks / m.total_checks) * 100 : 100,
		}));

		const incidents = mapRows<DbAlert>(alertsRes).map((a) => ({
			id: a.id,
			monitorName: a.monitor_name,
			status: a.status,
			startedAt: new Date(a.started_at).toISOString(),
			resolvedAt: a.resolved_at ? new Date(a.resolved_at).toISOString() : null,
			durationMs: a.duration_ms,
		}));

		return NextResponse.json({ title: page.title, slug, monitors, incidents });
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
