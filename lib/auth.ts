import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	secret: process.env.BETTER_AUTH_SECRET!,
	baseURL: process.env.NEXT_PUBLIC_BASE_URL ?? "https://pingwatch.vitalisnet.com",
	emailAndPassword: {
		enabled: true,
	},
	trustedOrigins: [
		"https://pingwatch.vitalisnet.com",
		"pingwatch://",
		"http://localhost:3000",
	],
});
