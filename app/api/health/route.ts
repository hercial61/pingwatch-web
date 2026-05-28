export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { tursoExecute } from "@/lib/turso";

export async function GET() {
	const dbUrl = process.env.TURSO_DATABASE_URL;
	const dbToken = process.env.TURSO_AUTH_TOKEN;

	if (!dbUrl || !dbToken) {
		return NextResponse.json({ status: "degraded", db: "not_configured", ts: Date.now() }, { status: 503 });
	}

	try {
		await tursoExecute(dbUrl, dbToken, "SELECT 1", []);
		return NextResponse.json({ status: "ok", db: "ok", ts: Date.now() });
	} catch (err) {
		return NextResponse.json(
			{ status: "degraded", db: "error", error: (err as Error).message, ts: Date.now() },
			{ status: 503 },
		);
	}
}
