import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function requireSession(req: NextRequest) {
	const session = await auth.api.getSession({ headers: req.headers });
	if (!session) throw new Error("Unauthorized");
	return session;
}
