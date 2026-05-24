export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";
import { ensureStatusPagesTable } from "@/lib/db-setup";
import crypto from "node:crypto";

const SLUG_RE = /^[a-z0-9-]{3,40}$/;

type DbPage = { id: string; user_id: string; slug: string; title: string };

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;
		await ensureStatusPagesTable();

		const res = await tursoExecute(dbUrl, dbToken,
			"SELECT id, user_id, slug, title FROM pw_status_pages WHERE user_id = ?",
			[session.user.id]);
		const [page] = mapRows<DbPage>(res);
		if (!page) return NextResponse.json(null);
		return NextResponse.json({ slug: page.slug, title: page.title });
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession(req);
		const { slug, title } = (await req.json()) as { slug?: string; title?: string };
		const dbUrl = process.env.TURSO_DATABASE_URL!;
		const dbToken = process.env.TURSO_AUTH_TOKEN!;

		const cleanSlug = (slug ?? "").trim().toLowerCase();
		const cleanTitle = (title ?? "System Status").trim().slice(0, 80) || "System Status";

		if (!SLUG_RE.test(cleanSlug)) {
			return NextResponse.json({ error: "Slug must be 3–40 characters: lowercase letters, numbers, and hyphens only." }, { status: 400 });
		}

		await ensureStatusPagesTable();

		const existing = mapRows<DbPage>(
			await tursoExecute(dbUrl, dbToken, "SELECT id FROM pw_status_pages WHERE user_id = ?", [session.user.id])
		);

		const now = Date.now();
		if (existing.length) {
			try {
				await tursoExecute(dbUrl, dbToken,
					"UPDATE pw_status_pages SET slug = ?, title = ?, updated_at = ? WHERE user_id = ?",
					[cleanSlug, cleanTitle, now, session.user.id]);
			} catch (e) {
				if ((e as Error).message?.includes("UNIQUE")) {
					return NextResponse.json({ error: "That slug is already taken. Try another." }, { status: 409 });
				}
				throw e;
			}
		} else {
			try {
				await tursoExecute(dbUrl, dbToken,
					"INSERT INTO pw_status_pages (id, user_id, slug, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
					[crypto.randomUUID(), session.user.id, cleanSlug, cleanTitle, now, now]);
			} catch (e) {
				if ((e as Error).message?.includes("UNIQUE")) {
					return NextResponse.json({ error: "That slug is already taken. Try another." }, { status: 409 });
				}
				throw e;
			}
		}

		return NextResponse.json({ slug: cleanSlug, title: cleanTitle });
	} catch (e) {
		if ((e as Error).message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
