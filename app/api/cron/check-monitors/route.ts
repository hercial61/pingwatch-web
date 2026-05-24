export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { runChecks } from "@/lib/monitor-checker";

export async function POST(req: NextRequest) {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

	const auth = req.headers.get("authorization") ?? "";
	if (auth !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	const dbUrl = process.env.TURSO_DATABASE_URL;
	const dbToken = process.env.TURSO_AUTH_TOKEN;
	if (!dbUrl || !dbToken) return NextResponse.json({ error: "db not configured" }, { status: 500 });

	try {
		const result = await runChecks(dbUrl, dbToken);
		return NextResponse.json({ ok: true, ...result });
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
