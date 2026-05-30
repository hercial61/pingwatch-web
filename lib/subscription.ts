import { tursoExecute } from "@/lib/turso";

export async function getUserIsPro(dbUrl: string, dbToken: string, email: string): Promise<boolean> {
	try {
		const result = await tursoExecute(dbUrl, dbToken,
			"SELECT 1 FROM pingwatch_purchases WHERE email = ? LIMIT 1", [email]);
		if (result.rows.length > 0) return true;
	} catch {
		// table may not exist yet
	}
	try {
		const now = Date.now();
		const result = await tursoExecute(dbUrl, dbToken,
			`SELECT 1 FROM pingwatch_subscriptions
       WHERE email = ?
       AND (
         status IN ('active', 'on_trial', 'paused')
         OR (status = 'cancelled' AND ends_at > ?)
       )
       LIMIT 1`,
			[email, now]);
		if (result.rows.length > 0) return true;
	} catch {
		// table may not exist yet
	}
	return false;
}
