export default function SuccessPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 12, letterSpacing: "-0.02em" }}>
          You&apos;re in — lifetime Pro unlocked!
        </h1>
        <p style={{ color: "#888", fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
          Check your email for your receipt. Open the PingWatch app and enter your purchase email to activate Pro on your device.
        </p>

        <div style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 12, padding: "20px 24px", marginBottom: 32, textAlign: "left" }}>
          <p style={{ color: "#aaa", fontSize: 14, marginBottom: 8, fontWeight: 600 }}>To activate on mobile:</p>
          <ol style={{ paddingLeft: 20, color: "#888", fontSize: 14, lineHeight: 2 }}>
            <li>Open the PingWatch app</li>
            <li>Go to Settings → Upgrade to Pro</li>
            <li>Tap <strong style={{ color: "#ccc" }}>Verify Purchase</strong></li>
            <li>Enter the email you used at checkout</li>
          </ol>
        </div>

        <a
          href="/"
          style={{ color: "#555", fontSize: 14, textDecoration: "underline" }}
        >
          ← Back to PingWatch
        </a>
      </div>
    </main>
  );
}
