export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { tursoExecute } from "@/lib/turso";

async function verifySignature(rawBody: string, sig: string, secret: string): Promise<boolean> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);
	const sigBytes = Uint8Array.from(
		(sig.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
	);
	return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(rawBody));
}

type LsEvent = {
	meta?: { event_id?: string };
	data?: {
		id?: unknown;
		attributes?: {
			user_email?: string;
			total?: number;
			status?: string;
			renews_at?: string | null;
			ends_at?: string | null;
		};
	};
};

async function ensurePurchasesTable(dbUrl: string, dbToken: string) {
	await tursoExecute(
		dbUrl,
		dbToken,
		`CREATE TABLE IF NOT EXISTS pingwatch_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      order_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`,
	);
	await tursoExecute(
		dbUrl,
		dbToken,
		"CREATE INDEX IF NOT EXISTS idx_pw_purchases_email ON pingwatch_purchases(email)",
	);
}

async function ensureSubscriptionsTable(dbUrl: string, dbToken: string) {
	await tursoExecute(
		dbUrl,
		dbToken,
		`CREATE TABLE IF NOT EXISTS pingwatch_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      subscription_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      renews_at INTEGER,
      ends_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
	);
	await tursoExecute(
		dbUrl,
		dbToken,
		"CREATE INDEX IF NOT EXISTS idx_pw_subs_email ON pingwatch_subscriptions(email)",
	);
}

export async function POST(req: NextRequest) {
	const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
	const dbUrl = process.env.TURSO_DATABASE_URL;
	const dbToken = process.env.TURSO_AUTH_TOKEN;

	if (!secret) return NextResponse.json({ error: "webhook secret not set" }, { status: 500 });
	if (!dbUrl || !dbToken) return NextResponse.json({ error: "db not configured" }, { status: 500 });

	const rawBody = await req.text();
	const sig = req.headers.get("x-signature") ?? "";
	const eventName = req.headers.get("x-event-name") ?? "";

	if (!(await verifySignature(rawBody, sig, secret))) {
		return NextResponse.json({ error: "invalid signature" }, { status: 401 });
	}

	let event: LsEvent;
	try {
		event = JSON.parse(rawBody) as LsEvent;
	} catch {
		return NextResponse.json({ error: "invalid json" }, { status: 400 });
	}

	const attrs = event.data?.attributes;
	const email = attrs?.user_email?.toLowerCase();
	const resourceId = String(event.data?.id ?? "");

	if (!email || !resourceId) {
		return NextResponse.json({ skipped: true, reason: "no email or resource id" });
	}

	// Lifetime purchase
	if (eventName === "order_created") {
		if (attrs?.status !== "paid") {
			return NextResponse.json({ skipped: true, reason: `status=${attrs?.status}` });
		}
		await ensurePurchasesTable(dbUrl, dbToken);
		await tursoExecute(
			dbUrl,
			dbToken,
			"INSERT OR IGNORE INTO pingwatch_purchases (email, order_id, created_at) VALUES (?, ?, ?)",
			[email, resourceId, Date.now()],
		);
		return NextResponse.json({ ok: true, event: eventName, email, orderId: resourceId });
	}

	// Monthly subscription events
	if (
		eventName === "subscription_created" ||
		eventName === "subscription_updated" ||
		eventName === "subscription_cancelled" ||
		eventName === "subscription_expired"
	) {
		const status = attrs?.status ?? "unknown";
		const renewsAt = attrs?.renews_at ? new Date(attrs.renews_at).getTime() : null;
		const endsAt = attrs?.ends_at ? new Date(attrs.ends_at).getTime() : null;
		const now = Date.now();

		await ensureSubscriptionsTable(dbUrl, dbToken);
		await tursoExecute(
			dbUrl,
			dbToken,
			`INSERT INTO pingwatch_subscriptions (email, subscription_id, status, renews_at, ends_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(subscription_id) DO UPDATE SET
         status = excluded.status,
         renews_at = excluded.renews_at,
         ends_at = excluded.ends_at,
         updated_at = excluded.updated_at`,
			[email, resourceId, status, renewsAt, endsAt, now, now],
		);
		return NextResponse.json({ ok: true, event: eventName, email, subscriptionId: resourceId, status });
	}

	return NextResponse.json({ ignored: true, eventName });
}
