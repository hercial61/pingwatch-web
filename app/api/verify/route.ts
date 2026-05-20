import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client/web";

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

  const db = createClient({ url: dbUrl, authToken: dbToken });

  let isPro = false;
  try {
    const result = await db.execute({
      sql: `SELECT 1 FROM pingwatch_purchases WHERE email = ? LIMIT 1`,
      args: [email],
    });
    isPro = result.rows.length > 0;
  } catch {
    // Table may not exist yet (no purchases recorded) — treat as not pro
    isPro = false;
  }

  return NextResponse.json({ isPro, email });
}
