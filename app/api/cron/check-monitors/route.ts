export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { runChecks } from "@/lib/monitor-checker";
import { validateEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

	const auth = req.headers.get("authorization") ?? "";
	if (auth !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	try {
		validateEnv();
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}

	const dbUrl = process.env.TURSO_DATABASE_URL!;
	const dbToken = process.env.TURSO_AUTH_TOKEN!;

	const t0 = Date.now();
	try {
		const result = await runChecks(dbUrl, dbToken);
		console.log(JSON.stringify({ route: "/api/cron/check-monitors", durationMs: Date.now() - t0, ...result, ts: new Date().toISOString() }));
		return NextResponse.json({ ok: true, ...result });
	} catch (e) {
		console.log(JSON.stringify({ route: "/api/cron/check-monitors", durationMs: Date.now() - t0, error: (e as Error).message, ts: new Date().toISOString() }));
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
