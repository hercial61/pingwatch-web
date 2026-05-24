import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { tursoExecute } from "@/lib/turso";
import { ensurePushTokensTable } from "@/lib/db-setup";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const body = (await req.json()) as { token?: string; platform?: string };
		const { token, platform } = body;
		if (!token || !platform) return NextResponse.json({ error: "token and platform required" }, { status: 400 });

		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await ensurePushTokensTable();

		const now = Date.now();
		await tursoExecute(
			dbUrl,
			dbToken,
			`INSERT INTO pw_push_tokens (id, user_id, token, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at`,
			[crypto.randomUUID(), session.user.id, token, platform, now, now],
		);

		return NextResponse.json({ ok: true });
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
