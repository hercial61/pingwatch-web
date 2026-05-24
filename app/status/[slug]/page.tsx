export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Monitor = { name: string; url: string; status: string; lastResponseTime: number | null; uptime: number };
type Incident = { id: string; monitorName: string; status: string; startedAt: string; resolvedAt: string | null; durationMs: number | null };
type StatusData = { title: string; slug: string; monitors: Monitor[]; incidents: Incident[] };

const STATUS_COLOR: Record<string, string> = { up: "#22c55e", down: "#ef4444", pending: "#eab308" };
const STATUS_LABEL: Record<string, string> = { up: "Operational", down: "Outage", pending: "Checking…" };

function formatDuration(ms: number) {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	return `${h}h ${m % 60}m`;
}

function formatTime(iso: string) {
	return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
}

async function fetchStatus(slug: string): Promise<StatusData | null> {
	const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://pingwatch.vitalisnet.com";
	const res = await fetch(`${base}/api/status/${slug}`, { cache: "no-store" });
	if (!res.ok) return null;
	return res.json() as Promise<StatusData>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params;
	const data = await fetchStatus(slug);
	return { title: data ? `${data.title} — PingWatch` : "Status Page" };
}

export default async function StatusPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const data = await fetchStatus(slug);
	if (!data) notFound();

	const { title, monitors, incidents } = data;
	const anyDown = monitors.some((m) => m.status === "down");
	const anyPending = monitors.some((m) => m.status === "pending");
	const overallStatus = anyDown ? "outage" : anyPending ? "checking" : "operational";
	const ongoingIncidents = incidents.filter((i) => i.status === "ongoing");

	const bannerBg = overallStatus === "operational" ? "rgba(34,197,94,0.1)" : overallStatus === "outage" ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)";
	const bannerColor = overallStatus === "operational" ? "#22c55e" : overallStatus === "outage" ? "#ef4444" : "#eab308";
	const bannerText = overallStatus === "operational" ? "All Systems Operational" : overallStatus === "outage" ? "Service Disruption Detected" : "Checking System Status";
	const bannerIcon = overallStatus === "operational" ? "✓" : overallStatus === "outage" ? "✕" : "○";

	return (
		<main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#ededed", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
			{/* Header */}
			<div style={{ borderBottom: "1px solid #161616", padding: "20px 24px" }}>
				<div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<div>
						<p style={{ fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Status Page</p>
						<h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</h1>
					</div>
					<a href="https://pingwatch.vitalisnet.com" style={{ color: "#444", fontSize: 12, textDecoration: "none" }}>
						Powered by 📡 PingWatch
					</a>
				</div>
			</div>

			<div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
				{/* Overall status banner */}
				<div style={{ background: bannerBg, border: `1px solid ${bannerColor}22`, borderRadius: 16, padding: "20px 24px", marginBottom: 32, display: "flex", alignItems: "center", gap: 14 }}>
					<span style={{ width: 36, height: 36, borderRadius: "50%", background: bannerColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
						{bannerIcon}
					</span>
					<div>
						<p style={{ fontWeight: 700, fontSize: 18, color: bannerColor }}>{bannerText}</p>
						<p style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Updated {formatTime(new Date().toISOString())}</p>
					</div>
				</div>

				{/* Monitors */}
				<h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", marginBottom: 12 }}>Services</h2>
				{monitors.length === 0 ? (
					<div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "32px", textAlign: "center", color: "#555" }}>No monitors configured.</div>
				) : (
					<div style={{ marginBottom: 36 }}>
						{monitors.map((m) => (
							<div key={m.name} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 20px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
										<span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[m.status] ?? "#666", display: "inline-block", flexShrink: 0 }} />
										<span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
									</div>
									<p style={{ fontSize: 12, color: "#555", marginLeft: 16 }}>{m.url}</p>
								</div>
								<div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
									{m.lastResponseTime !== null && (
										<div style={{ textAlign: "right" }}>
											<p style={{ fontSize: 11, color: "#444" }}>Response</p>
											<p style={{ fontSize: 13, fontWeight: 600 }}>{m.lastResponseTime}ms</p>
										</div>
									)}
									<div style={{ textAlign: "right" }}>
										<p style={{ fontSize: 11, color: "#444" }}>Uptime</p>
										<p style={{ fontSize: 13, fontWeight: 600 }}>{m.uptime.toFixed(2)}%</p>
									</div>
									<span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[m.status] ?? "#666", background: "rgba(255,255,255,0.05)", padding: "3px 10px", borderRadius: 99, whiteSpace: "nowrap" }}>
										{STATUS_LABEL[m.status] ?? m.status}
									</span>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Active incidents */}
				{ongoingIncidents.length > 0 && (
					<>
						<h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ef4444", marginBottom: 12 }}>Active Incidents</h2>
						<div style={{ marginBottom: 36 }}>
							{ongoingIncidents.map((inc) => (
								<div key={inc.id} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 8 }}>
									<p style={{ fontWeight: 600, marginBottom: 4 }}>{inc.monitorName} — Outage ongoing</p>
									<p style={{ fontSize: 13, color: "#888" }}>Started {formatTime(inc.startedAt)}</p>
								</div>
							))}
						</div>
					</>
				)}

				{/* Incident history */}
				<h2 style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555", marginBottom: 12 }}>Incident History (30 days)</h2>
				{incidents.filter((i) => i.status === "resolved").length === 0 && ongoingIncidents.length === 0 ? (
					<div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "20px", textAlign: "center", color: "#555", fontSize: 14 }}>
						No incidents in the last 30 days.
					</div>
				) : (
					incidents.filter((i) => i.status === "resolved").map((inc) => (
						<div key={inc.id} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 20px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
							<div>
								<p style={{ fontWeight: 500, fontSize: 14 }}>{inc.monitorName}</p>
								<p style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{formatTime(inc.startedAt)}{inc.durationMs !== null ? ` · ${formatDuration(inc.durationMs)}` : ""}</p>
							</div>
							<span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.08)", padding: "3px 10px", borderRadius: 99 }}>Resolved</span>
						</div>
					))
				)}
			</div>
		</main>
	);
}
