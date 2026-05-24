export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { tursoExecute } from "@/lib/turso";

export async function GET(req: NextRequest) {
	const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
	if (!email) {
		return NextResponse.json({ error: "email required" }, { status: 400 });
	}

	const dbUrl = process.env.TURSO_DATABASE_URL;
	const dbToken = process.env.TURSO_AUTH_TOKEN;
	if (!dbUrl || !dbToken) {
		return NextResponse.json({ error: "db not configured" }, { status: 500 });
	}

	// Check lifetime purchase
	let isPro = false;
	try {
		const result = await tursoExecute(
			dbUrl,
			dbToken,
			"SELECT 1 FROM pingwatch_purchases WHERE email = ? LIMIT 1",
			[email],
		);
		isPro = result.rows.length > 0;
	} catch {
		// table may not exist yet
	}

	// Check active monthly subscription
	if (!isPro) {
		try {
			const now = Date.now();
			// active/on_trial: full access; cancelled: access until ends_at
			const result = await tursoExecute(
				dbUrl,
				dbToken,
				`SELECT 1 FROM pingwatch_subscriptions
         WHERE email = ?
         AND (
           status IN ('active', 'on_trial', 'paused')
           OR (status = 'cancelled' AND ends_at > ?)
         )
         LIMIT 1`,
				[email, now],
			);
			isPro = result.rows.length > 0;
		} catch {
			// table may not exist yet
		}
	}

	return NextResponse.json({ isPro, email });
}
