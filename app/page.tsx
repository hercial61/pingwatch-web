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

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() || undefined }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create checkout");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        {/* Logo / brand */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📡</div>
          <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>PingWatch</h1>
          <p style={{ color: "#888", marginTop: 8 }}>Uptime monitoring that never sleeps</p>
        </div>

        {/* Card */}
        <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 16, padding: "36px 32px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: "#fff" }}>$49</span>
            <span style={{ color: "#888", fontSize: 16 }}>one-time</span>
          </div>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 28 }}>Lifetime Pro — pay once, use forever</p>

          <ul style={{ listStyle: "none", marginBottom: 32 }}>
            {FEATURES.map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", color: "#ccc", fontSize: 15 }}>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          {/* Optional email for pre-fill */}
          <input
            type="email"
            placeholder="Your email (optional — speeds up checkout)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8,
              border: "1px solid #2a2a2a", background: "#0f0f0f",
              color: "#ededed", fontSize: 15, marginBottom: 12,
              outline: "none",
            }}
          />

          <button
            onClick={handleBuy}
            disabled={loading}
            style={{
              width: "100%", padding: "14px", borderRadius: 10,
              background: loading ? "#333" : "#fff", color: "#0a0a0a",
              fontWeight: 700, fontSize: 16, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Redirecting…" : "Get Lifetime Access →"}
          </button>

          {error && <p style={{ color: "#f87171", fontSize: 14, marginTop: 12, textAlign: "center" }}>{error}</p>}

          <p style={{ color: "#555", fontSize: 13, textAlign: "center", marginTop: 16 }}>
            Secure checkout via Lemon Squeezy · Card, PayPal, Apple Pay
          </p>
        </div>

        {/* Verify section */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <p style={{ color: "#555", fontSize: 14 }}>
            Already purchased?{" "}
            <a href="/verify" style={{ color: "#888", textDecoration: "underline" }}>Verify your purchase</a>
          </p>
        </div>
      </div>
    </main>
  );
}
