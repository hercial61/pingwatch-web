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
    isPro = false;
  }

  return NextResponse.json({ isPro, email });
}
