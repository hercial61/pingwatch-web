"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const inp: React.CSSProperties = {
	width: "100%", padding: "11px 14px", borderRadius: 8,
	border: "1px solid #2a2a2a", background: "#0f0f0f", color: "#ededed",
	fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 12,
};
const btn: React.CSSProperties = {
	width: "100%", padding: "12px", borderRadius: 10,
	background: "#fff", color: "#0a0a0a", border: "none",
	fontWeight: 700, fontSize: 15, cursor: "pointer",
};

export default function SignInPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(""); setLoading(true);
		try {
			const { error: authError } = await authClient.signIn.email({ email, password });
			if (authError) { setError(authError.message ?? "Invalid email or password."); return; }
			router.push("/dashboard");
		} catch {
			setError("Could not reach server. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
			<div style={{ width: "100%", maxWidth: 400 }}>
				<div style={{ textAlign: "center", marginBottom: 32 }}>
					<div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
					<h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>PingWatch</h1>
					<p style={{ color: "#888", marginTop: 6 }}>Sign in to your account</p>
				</div>
				<form onSubmit={handleSubmit}>
					<label style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 4 }}>Email</label>
					<input style={inp} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
					<label style={{ display: "block", fontSize: 13, color: "#aaa", marginBottom: 4 }}>Password</label>
					<input style={inp} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
					{error && <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{error}</p>}
					<button type="submit" style={btn} disabled={loading}>
						{loading ? "Signing in…" : "Sign In →"}
					</button>
				</form>
				<p style={{ textAlign: "center", marginTop: 20, color: "#666", fontSize: 14 }}>
					No account?{" "}
					<a href="/sign-up" style={{ color: "#888", textDecoration: "underline" }}>Sign up</a>
				</p>
			</div>
		</main>
	);
}
