import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

export const runtime = "edge";

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

type LsOrderEvent = {
  meta?: { event_id?: string };
  data?: {
    id?: unknown;
    attributes?: {
      user_email?: string;
      total?: number;
      status?: string;
    };
  };
};

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

  // Only care about completed orders
  if (eventName !== "order_created") {
    return NextResponse.json({ ignored: true, eventName });
  }

  let event: LsOrderEvent;
  try {
    event = JSON.parse(rawBody) as LsOrderEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const attrs = event.data?.attributes;
  const email = attrs?.user_email;
  const orderId = String(event.data?.id ?? "");
  const status = attrs?.status ?? "";

  if (!email || !orderId) {
    return NextResponse.json({ skipped: true, reason: "no email or order id" });
  }

  // Only process paid orders
  if (status !== "paid") {
    return NextResponse.json({ skipped: true, reason: `status=${status}` });
  }

  const db = createClient({ url: dbUrl, authToken: dbToken });

  // Ensure the purchases table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pingwatch_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      order_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_pw_purchases_email ON pingwatch_purchases(email)
  `);

  // Idempotent insert
  await db.execute({
    sql: `INSERT OR IGNORE INTO pingwatch_purchases (email, order_id, created_at) VALUES (?, ?, ?)`,
    args: [email.toLowerCase(), orderId, Date.now()],
  });

  return NextResponse.json({ ok: true, email, orderId });
}
