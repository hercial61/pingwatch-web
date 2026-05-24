import { type NextRequest, NextResponse } from "next/server";
import { runAllMigrations } from "@/lib/auth-migrate";

export async function POST(req: NextRequest) {
	const secret = process.env.SETUP_SECRET ?? process.env.CRON_SECRET;
	if (!secret) return NextResponse.json({ error: "no setup secret configured" }, { status: 500 });

	const auth = req.headers.get("authorization") ?? "";
	if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	try {
		const result = await runAllMigrations();
		return NextResponse.json(result);
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
