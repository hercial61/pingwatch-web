"use client";
import { useState } from "react";

const FEATURES = [
	"Unlimited monitors",
	"30-second check intervals",
	"SMS + email + push alerts",
	"Status pages",
	"90-day incident history",
	"iOS & Android apps",
	"All future features included",
];

type Plan = "monthly" | "lifetime";

export default function PricingPage() {
	const [loading, setLoading] = useState<Plan | null>(null);
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");

	async function handleBuy(plan: Plan) {
		setLoading(plan);
		setError("");
		try {
			const res = await fetch("/api/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim() || undefined, plan }),
			});
			const data = (await res.json()) as { url?: string; error?: string };
			if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create checkout");
			window.location.href = data.url;
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong");
			setLoading(null);
		}
	}

	return (
		<main
			style={{
				minHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "48px 24px",
			}}
		>
			<div style={{ maxWidth: 560, width: "100%" }}>
				{/* Logo / brand */}
				<div style={{ textAlign: "center", marginBottom: 40 }}>
					<div style={{ fontSize: 40, marginBottom: 8 }}>📡</div>
					<h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
						PingWatch
					</h1>
					<p style={{ color: "#888", marginTop: 8 }}>Uptime monitoring that never sleeps</p>
				</div>

				{/* Feature list */}
				<ul style={{ listStyle: "none", margin: "0 0 28px", padding: 0 }}>
					{FEATURES.map((f) => (
						<li
							key={f}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: "5px 0",
								color: "#ccc",
								fontSize: 15,
							}}
						>
							<span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
							{f}
						</li>
					))}
				</ul>

				{/* Shared email input */}
				<input
					type="email"
					placeholder="Your email (optional — speeds up checkout)"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					style={{
						width: "100%",
						padding: "12px 14px",
						borderRadius: 8,
						border: "1px solid #2a2a2a",
						background: "#0f0f0f",
						color: "#ededed",
						fontSize: 15,
						marginBottom: 16,
						outline: "none",
						boxSizing: "border-box",
					}}
				/>

				{/* Plan cards */}
				<div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
					{/* Monthly */}
					<div
						style={{
							flex: "1 1 200px",
							background: "#161616",
							border: "1px solid #2a2a2a",
							borderRadius: 16,
							padding: "24px 20px",
						}}
					>
						<div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
							<span style={{ fontSize: 36, fontWeight: 700, color: "#fff" }}>$9</span>
							<span style={{ color: "#888", fontSize: 14 }}>/month</span>
						</div>
						<p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Cancel anytime</p>
						<button
							onClick={() => handleBuy("monthly")}
							disabled={loading !== null}
							style={{
								width: "100%",
								padding: "12px",
								borderRadius: 10,
								background: loading === "monthly" ? "#333" : "#1a1a1a",
								color: "#ededed",
								border: "1px solid #3a3a3a",
								fontWeight: 700,
								fontSize: 15,
								cursor: loading !== null ? "not-allowed" : "pointer",
								transition: "background 0.15s",
							}}
						>
							{loading === "monthly" ? "Redirecting…" : "Get Monthly Access →"}
						</button>
					</div>

					{/* Lifetime */}
					<div
						style={{
							flex: "1 1 200px",
							background: "#161616",
							border: "1px solid #3a3a3a",
							borderRadius: 16,
							padding: "24px 20px",
							position: "relative",
						}}
					>
						<div
							style={{
								position: "absolute",
								top: -12,
								left: "50%",
								transform: "translateX(-50%)",
								background: "#22c55e",
								color: "#000",
								fontWeight: 700,
								fontSize: 12,
								padding: "3px 14px",
								borderRadius: 99,
								whiteSpace: "nowrap",
							}}
						>
							Best Value
						</div>
						<div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
							<span style={{ fontSize: 36, fontWeight: 700, color: "#fff" }}>$49</span>
							<span style={{ color: "#888", fontSize: 14 }}>one-time</span>
						</div>
						<p style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Pay once, use forever</p>
						<button
							onClick={() => handleBuy("lifetime")}
							disabled={loading !== null}
							style={{
								width: "100%",
								padding: "12px",
								borderRadius: 10,
								background: loading === "lifetime" ? "#333" : "#fff",
								color: "#0a0a0a",
								border: "none",
								fontWeight: 700,
								fontSize: 15,
								cursor: loading !== null ? "not-allowed" : "pointer",
								transition: "background 0.15s",
							}}
						>
							{loading === "lifetime" ? "Redirecting…" : "Get Lifetime Access →"}
						</button>
					</div>
				</div>

				{error && (
					<p style={{ color: "#f87171", fontSize: 14, textAlign: "center", marginBottom: 12 }}>
						{error}
					</p>
				)}

				<p style={{ color: "#555", fontSize: 13, textAlign: "center", marginBottom: 32 }}>
					Secure checkout via Lemon Squeezy · Card, PayPal, Apple Pay
				</p>

				{/* Verify */}
				<div style={{ textAlign: "center" }}>
					<p style={{ color: "#555", fontSize: 14 }}>
						Already purchased?{" "}
						<a href="/verify" style={{ color: "#888", textDecoration: "underline" }}>
							Verify your purchase
						</a>
					</p>
				</div>
			</div>
		</main>
	);
}
