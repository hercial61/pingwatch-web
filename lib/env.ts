const REQUIRED = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "CRON_SECRET", "BETTER_AUTH_SECRET"] as const;

export function validateEnv(): void {
	const missing = REQUIRED.filter((k) => !process.env[k]);
	if (missing.length > 0) {
		throw new Error(`Missing required env vars: ${missing.join(", ")}`);
	}
}
