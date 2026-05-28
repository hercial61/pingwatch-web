import { type NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export function middleware(req: NextRequest) {
	if (req.nextUrl.pathname.startsWith("/api/status/")) {
		const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
		if (!rateLimit(ip, 30, 60_000)) {
			return NextResponse.json({ error: "Too many requests" }, { status: 429 });
		}
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/api/status/:path*"],
};
