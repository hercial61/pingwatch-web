"use client";
import { useState } from "react";

type VerifyResult = { isPro: boolean; email: string };

export default function VerifyPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/verify?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json() as VerifyResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>Verify Purchase</h1>
          <p style={{ color: "#666", marginTop: 8, fontSize: 15 }}>Enter the email you used at checkout</p>
        </div>

        <form onSubmit={handleVerify} style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, padding: "28px 24px" }}>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8,
              border: "1px solid #2a2a2a", background: "#0f0f0f",
              color: "#ededed", fontSize: 15, marginBottom: 12, outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: 8,
              background: loading ? "#333" : "#fff", color: "#0a0a0a",
              fontWeight: 700, fontSize: 15, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Checking…" : "Check Status"}
          </button>

          {error && <p style={{ color: "#f87171", fontSize: 14, marginTop: 12, textAlign: "center" }}>{error}</p>}

          {result && (
            <div style={{
              marginTop: 20, padding: "16px", borderRadius: 8,
              background: result.isPro ? "#0d1f0d" : "#1f0d0d",
              border: `1px solid ${result.isPro ? "#22c55e40" : "#f8717140"}`,
              textAlign: "center",
            }}>
              <p style={{ fontSize: 22, marginBottom: 4 }}>{result.isPro ? "✅" : "❌"}</p>
              <p style={{ color: result.isPro ? "#22c55e" : "#f87171", fontWeight: 600, fontSize: 16 }}>
                {result.isPro ? "Lifetime Pro confirmed" : "No purchase found"}
              </p>
              <p style={{ color: "#555", fontSize: 13, marginTop: 4 }}>{result.email}</p>
              {result.isPro && (
                <p style={{ color: "#666", fontSize: 13, marginTop: 8 }}>
                  Open PingWatch → Settings → Verify Purchase and enter this email.
                </p>
              )}
            </div>
          )}
        </form>

        <p style={{ textAlign: "center", marginTop: 24, color: "#444", fontSize: 14 }}>
          <a href="/" style={{ color: "#555", textDecoration: "underline" }}>← Back to pricing</a>
        </p>
      </div>
    </main>
  );
}
