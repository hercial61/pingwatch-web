export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";

type DbCheckResult = {
	checked_at: number;
	response_time_ms: number | null;
	status_code: number | null;
	status: string;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await requireSession(req);
		const { id } = await params;
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;

		// Verify monitor belongs to this user
		const monRes = await tursoExecute(dbUrl, dbToken, "SELECT id FROM pw_monitors WHERE id = ? AND user_id = ? AND enabled = 1", [id, session.user.id]);
		if (mapRows(monRes).length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

		const limitParam = req.nextUrl.searchParams.get("limit");
		const limit = Math.min(Math.max(1, parseInt(limitParam ?? "50", 10) || 50), 200);

		const res = await tursoExecute(
			dbUrl,
			dbToken,
			"SELECT checked_at, response_time_ms, status_code, status FROM pw_http_check_results WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?",
			[id, limit],
		);
		const rows = mapRows<DbCheckResult>(res);
		return NextResponse.json(rows.map((r) => ({
			checkedAt: new Date(r.checked_at).toISOString(),
			responseTimeMs: r.response_time_ms,
			statusCode: r.status_code,
			status: r.status,
		})));
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
