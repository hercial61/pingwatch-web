import { type NextRequest, NextResponse } from "next/server";
import { getRevenueSummary } from "@/lib/revenue";

export async function GET(req: NextRequest) {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
	}

	const auth = req.headers.get("authorization") ?? "";
	if (auth !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const dbUrl = process.env.TURSO_DATABASE_URL;
	const dbToken = process.env.TURSO_AUTH_TOKEN;
	if (!dbUrl || !dbToken) {
		return NextResponse.json({ error: "db not configured" }, { status: 500 });
	}

	try {
		const summary = await getRevenueSummary(dbUrl, dbToken);
		return NextResponse.json(summary);
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
