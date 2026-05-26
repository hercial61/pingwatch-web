"use client";
import { useState } from "react";

// ─── Checkout logic (kept from original) ────────────────────────────────────
type Plan = "monthly" | "lifetime";

async function startCheckout(email: string, plan: Plan): Promise<string> {
	const res = await fetch("/api/checkout", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: email.trim() || undefined, plan }),
	});
	const data = (await res.json()) as { url?: string; error?: string };
	if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create checkout");
	return data.url;
}

// ─── Mock monitor cards for the hero demo ───────────────────────────────────
const MOCK_MONITORS = [
	{ name: "API Gateway", url: "api.example.com", status: "up" as const, uptime: 99.98, ms: 142 },
	{ name: "Main Website", url: "example.com", status: "up" as const, uptime: 100, ms: 87 },
	{ name: "Checkout Service", url: "checkout.example.com", status: "down" as const, uptime: 99.1, ms: null, insight: "The server returned HTTP 503, likely due to a temporary overload or a failed deployment." },
];

const STATUS_COLOR = { up: "#22c55e", down: "#ef4444", pending: "#eab308" };
const STATUS_LABEL = { up: "UP", down: "DOWN", pending: "PENDING" };

function MockMonitorCard({ m }: { m: typeof MOCK_MONITORS[0] }) {
	return (
		<div style={{
			background: "#111", border: `1px solid ${m.status === "down" ? "#3a1212" : "#1e1e1e"}`,
			borderRadius: 14, padding: "16px 20px", marginBottom: 10,
		}}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
						<span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[m.status], display: "inline-block", flexShrink: 0 }} />
						<span style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</span>
						<span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[m.status], background: "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 99 }}>
							{STATUS_LABEL[m.status]}
						</span>
					</div>
					<p style={{ color: "#555", fontSize: 12, marginLeft: 16 }}>{m.url}</p>
				</div>
				<div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
					<div style={{ textAlign: "center" }}>
						<p style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Uptime</p>
						<p style={{ fontSize: 13, fontWeight: 600 }}>{m.uptime}%</p>
					</div>
					{m.ms !== null && (
						<div style={{ textAlign: "center" }}>
							<p style={{ fontSize: 10, color: "#444", marginBottom: 2 }}>Response</p>
							<p style={{ fontSize: 13, fontWeight: 600 }}>{m.ms}ms</p>
						</div>
					)}
				</div>
			</div>
			{"insight" in m && m.insight && (
				<div style={{ marginTop: 12, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 10, padding: "8px 12px" }}>
					<p style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>AI Insight</p>
					<p style={{ fontSize: 12, color: "#93c5fd", lineHeight: 1.5 }}>{m.insight}</p>
				</div>
			)}
		</div>
	);
}

// ─── Feature grid ────────────────────────────────────────────────────────────
const FEATURES = [
	{ icon: "⚡", title: "60-second checks", body: "Your monitors ping every minute, around the clock. No gaps." },
	{ icon: "🔔", title: "Instant push alerts", body: "iOS and Android push notifications the moment a site goes down — and again when it recovers." },
	{ icon: "🤖", title: "AI incident insights", body: "Claude AI analyzes each outage and tells you the most likely cause in plain English." },
	{ icon: "📊", title: "Uptime & response stats", body: "Track uptime percentage and response time across all your monitors at a glance." },
	{ icon: "🌐", title: "Web + mobile", body: "Manage monitors from the dashboard or the iOS/Android app — in sync, always." },
	{ icon: "🔒", title: "Your data only", body: "Every monitor is scoped to your account. No shared visibility, no leakage." },
];

// ─── Page ────────────────────────────────────────────────────────────────────
export default function HomePage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState<Plan | null>(null);
	const [error, setError] = useState("");

	async function handleBuy(plan: Plan) {
		setLoading(plan); setError("");
		try {
			window.location.href = await startCheckout(email, plan);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong");
			setLoading(null);
		}
	}

	return (
		<>
			{/* ── Nav ─────────────────────────────────────────────────────── */}
			<nav style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid #161616", padding: "0 24px" }}>
				<div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
					<span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>📡 PingWatch</span>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						<a href="/sign-in" style={{ color: "#888", fontSize: 14, textDecoration: "none" }}>Sign in</a>
						<a href="/sign-up" style={{ background: "#fff", color: "#0a0a0a", borderRadius: 8, padding: "7px 16px", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
							Get started free →
						</a>
					</div>
				</div>
			</nav>

			{/* ── Hero ─────────────────────────────────────────────────────── */}
			<section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px 60px" }}>
				<div style={{ display: "flex", gap: 60, alignItems: "flex-start", flexWrap: "wrap" }}>
					{/* Left: copy */}
					<div style={{ flex: "1 1 360px" }}>
						<p style={{ display: "inline-block", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, marginBottom: 20, letterSpacing: "0.05em", textTransform: "uppercase" }}>
							Uptime monitoring
						</p>
						<h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 20 }}>
							Know the moment<br />your site goes down.
						</h1>
						<p style={{ color: "#888", fontSize: 18, lineHeight: 1.6, marginBottom: 32, maxWidth: 480 }}>
							PingWatch checks your URLs every 60 seconds and sends an instant push notification when anything goes wrong — plus an AI explanation of why.
						</p>
						<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
							<a href="/sign-up" style={{ background: "#fff", color: "#0a0a0a", borderRadius: 10, padding: "13px 24px", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
								Start monitoring free →
							</a>
							<a href="/sign-in" style={{ background: "transparent", color: "#888", borderRadius: 10, padding: "13px 24px", fontSize: 15, fontWeight: 600, textDecoration: "none", border: "1px solid #2a2a2a" }}>
								Sign in
							</a>
						</div>
						<p style={{ marginTop: 16, color: "#444", fontSize: 13 }}>No credit card required · Free to start</p>
					</div>

					{/* Right: live mock */}
					<div style={{ flex: "1 1 320px" }}>
						<div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 18, padding: "20px 16px" }}>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingLeft: 4 }}>
								<span style={{ color: "#555", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Your Monitors</span>
								<span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>● 1 down</span>
							</div>
							{MOCK_MONITORS.map((m) => <MockMonitorCard key={m.name} m={m} />)}
						</div>
					</div>
				</div>
			</section>

			{/* ── How it works ─────────────────────────────────────────────── */}
			<section style={{ borderTop: "1px solid #161616", borderBottom: "1px solid #161616", padding: "64px 24px", background: "#080808" }}>
				<div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
					<h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Up and running in 30 seconds</h2>
					<p style={{ color: "#666", marginBottom: 48 }}>No config files. No agents to install.</p>
					<div style={{ display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap", textAlign: "left" }}>
						{[
							{ step: "1", title: "Add a URL", body: "Paste any URL — your API, your homepage, your checkout page." },
							{ step: "2", title: "We watch it", body: "PingWatch pings it every 60 seconds from our servers." },
							{ step: "3", title: "Get alerted", body: "You get a push notification the second it goes down, with an AI explanation." },
						].map(({ step, title, body }) => (
							<div key={step} style={{ flex: "1 1 220px", maxWidth: 260 }}>
								<div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", marginBottom: 14, fontSize: 14 }}>
									{step}
								</div>
								<h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{title}</h3>
								<p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>{body}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Features ─────────────────────────────────────────────────── */}
			<section style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}>
				<h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 48, textAlign: "center" }}>Everything you need</h2>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
					{FEATURES.map(({ icon, title, body }) => (
						<div key={title} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 16, padding: "24px" }}>
							<span style={{ fontSize: 28, display: "block", marginBottom: 14 }}>{icon}</span>
							<h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{title}</h3>
							<p style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>{body}</p>
						</div>
					))}
				</div>
			</section>

			{/* ── Pricing ──────────────────────────────────────────────────── */}
			<section id="pricing" style={{ borderTop: "1px solid #161616", background: "#080808", padding: "72px 24px" }}>
				<div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
					<h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Simple pricing</h2>
					<p style={{ color: "#666", marginBottom: 36 }}>One product, two ways to pay.</p>

					<input
						type="email"
						placeholder="Your email (optional — speeds up checkout)"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #2a2a2a", background: "#0f0f0f", color: "#ededed", fontSize: 15, marginBottom: 20, outline: "none", boxSizing: "border-box" }}
					/>

					<div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
						{/* Monthly */}
						<div style={{ flex: "1 1 200px", background: "#161616", border: "1px solid #2a2a2a", borderRadius: 16, padding: "24px 20px" }}>
							<div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
								<span style={{ fontSize: 36, fontWeight: 700 }}>$9</span>
								<span style={{ color: "#666", fontSize: 14 }}>/month</span>
							</div>
							<p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>Cancel anytime</p>
							<button onClick={() => handleBuy("monthly")} disabled={loading !== null}
								style={{ width: "100%", padding: 12, borderRadius: 10, background: loading === "monthly" ? "#333" : "#1a1a1a", color: "#ededed", border: "1px solid #3a3a3a", fontWeight: 700, fontSize: 15, cursor: loading !== null ? "not-allowed" : "pointer" }}>
								{loading === "monthly" ? "Redirecting…" : "Get Monthly →"}
							</button>
						</div>

						{/* Lifetime */}
						<div style={{ flex: "1 1 200px", background: "#161616", border: "1px solid #3a3a3a", borderRadius: 16, padding: "24px 20px", position: "relative" }}>
							<div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "#000", fontWeight: 700, fontSize: 12, padding: "3px 14px", borderRadius: 99, whiteSpace: "nowrap" }}>
								Best Value
							</div>
							<div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
								<span style={{ fontSize: 36, fontWeight: 700 }}>$49</span>
								<span style={{ color: "#666", fontSize: 14 }}>one-time</span>
							</div>
							<p style={{ color: "#555", fontSize: 13, marginBottom: 4 }}>Pay once, use forever</p>
							<p style={{ color: "#22c55e", fontSize: 12, marginBottom: 20 }}>30-day money-back guarantee</p>
							<button onClick={() => handleBuy("lifetime")} disabled={loading !== null}
								style={{ width: "100%", padding: 12, borderRadius: 10, background: loading === "lifetime" ? "#333" : "#fff", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 15, cursor: loading !== null ? "not-allowed" : "pointer" }}>
								{loading === "lifetime" ? "Redirecting…" : "Get Lifetime →"}
							</button>
						</div>
					</div>

					{error && <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{error}</p>}
					<p style={{ color: "#444", fontSize: 13 }}>Secure checkout via Lemon Squeezy · Card, PayPal, Apple Pay</p>
					<p style={{ color: "#555", fontSize: 12, marginTop: 8 }}>Not happy within 30 days? Email hvitalis59@gmail.com for a full refund — no questions asked.</p>
				</div>
			</section>

			{/* ── Footer ───────────────────────────────────────────────────── */}
			<footer style={{ borderTop: "1px solid #161616", padding: "24px", textAlign: "center" }}>
				<div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
					<span style={{ color: "#444", fontSize: 13 }}>© 2026 PingWatch · Vitalis &amp; Co</span>
					<div style={{ display: "flex", gap: 24 }}>
						<a href="/privacy" style={{ color: "#555", fontSize: 13 }}>Privacy</a>
						<a href="/verify" style={{ color: "#555", fontSize: 13 }}>Verify purchase</a>
						<a href="/sign-in" style={{ color: "#555", fontSize: 13 }}>Sign in</a>
						<a href="#pricing" style={{ color: "#555", fontSize: 13 }}>Pricing</a>
					</div>
				</div>
			</footer>
		</>
	);
}
