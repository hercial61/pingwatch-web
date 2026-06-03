import { tursoExecute } from "@/lib/turso";
import { mapRows } from "@/lib/db-rows";

const counters = new Map<string, { n: number; reset: number }>();

// In-memory limiter. Fine for a single long-lived process, but on serverless /
// Cloudflare Workers the Map is per-isolate and ephemeral, so it does NOT bound
// usage globally. Use `rateLimitDb` for anything that gates real cost.
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const entry = counters.get(key);
	if (!entry || now > entry.reset) {
		counters.set(key, { n: 1, reset: now + windowMs });
		return true;
	}
	if (entry.n >= limit) return false;
	entry.n++;
	return true;
}

// Durable, DB-backed sliding-window limiter. State lives in Turso, so the limit
// holds across isolates, instances, and deploys — suitable for cost control.
// Requires `ensureRateLimitTable()` (lib/db-setup) to have run.
// Returns true if the request is allowed. Fails OPEN on DB error (it's a soft
// cost guard, not a security control) so a transient blip never locks users out.
export async function rateLimitDb(
	dbUrl: string,
	dbToken: string,
	key: string,
	limit: number,
	windowMs: number,
): Promise<boolean> {
	const now = Date.now();
	const resetAt = now + windowMs;
	try {
		// Single atomic upsert: insert a fresh window, or increment within the
		// current window / reset it if expired. RETURNING gives the new count.
		const res = await tursoExecute(
			dbUrl,
			dbToken,
			`INSERT INTO pw_rate_limits (key, count, reset_at) VALUES (?, 1, ?)
			 ON CONFLICT(key) DO UPDATE SET
			   count = CASE WHEN pw_rate_limits.reset_at < ? THEN 1 ELSE pw_rate_limits.count + 1 END,
			   reset_at = CASE WHEN pw_rate_limits.reset_at < ? THEN ? ELSE pw_rate_limits.reset_at END
			 RETURNING count`,
			[key, resetAt, now, now, resetAt],
		);
		const [row] = mapRows<{ count: number }>(res);
		return (row?.count ?? 1) <= limit;
	} catch {
		return true;
	}
}
