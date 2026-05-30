"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type StatusPage = { slug: string; title: string } | null;

type MonitorStatus = "up" | "down" | "pending";

type Monitor = {
	id: string;
	name: string;
	url: string;
	interval: number;
	status: MonitorStatus;
	lastCheckedAt: string | null;
	lastResponseTime: number | null;
	uptime: number;
	createdAt: string;
	monitorType: "heartbeat" | "http";
	sslExpiryAt: string | null;
};

type CheckResult = {
	checkedAt: string;
	responseTimeMs: number | null;
	statusCode: number | null;
	status: string;
};

const STATUS_DOT: Record<MonitorStatus, string> = { up: "#22c55e", down: "#ef4444", pending: "#eab308" };
const STATUS_LABEL: Record<MonitorStatus, string> = { up: "UP", down: "DOWN", pending: "PENDING" };

const card: React.CSSProperties = {
	background: "#111", border: "1px solid #1e1e1e", borderRadius: 16,
	padding: "20px 24px", marginBottom: 12,
};
const inp: React.CSSProperties = {
	flex: 1, padding: "10px 14px", borderRadius: 8,
	border: "1px solid #2a2a2a", background: "#0f0f0f", color: "#ededed",
	fontSize: 14, outline: "none", boxSizing: "border-box",
};

export default function DashboardPage() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [monitors, setMonitors] = useState<Monitor[]>([]);
	const [loadingMonitors, setLoadingMonitors] = useState(true);
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [adding, setAdding] = useState(false);
	const [addError, setAddError] = useState("");
	const [deleting, setDeleting] = useState<string | null>(null);
	const [statusPage, setStatusPage] = useState<StatusPage>(undefined as unknown as StatusPage);
	const [spSlug, setSpSlug] = useState("");
	const [spTitle, setSpTitle] = useState("System Status");
	const [spSaving, setSpSaving] = useState(false);
	const [spError, setSpError] = useState("");
	const [spSaved, setSpSaved] = useState(false);
	const [expandedMonitor, setExpandedMonitor] = useState<string | null>(null);
	const [responseTimes, setResponseTimes] = useState<Record<string, CheckResult[]>>({});
	const [loadingRT, setLoadingRT] = useState<string | null>(null);

	const fetchMonitors = useCallback(async () => {
		const res = await fetch("/api/monitors");
		if (res.ok) setMonitors(await res.json() as Monitor[]);
		setLoadingMonitors(false);
	}, []);

	const fetchStatusPage = useCallback(async () => {
		const res = await fetch("/api/status-pages");
		const data = res.ok ? await res.json() as StatusPage : null;
		setStatusPage(data);
		if (data) { setSpSlug(data.slug); setSpTitle(data.title); }
	}, []);

	useEffect(() => {
		if (!isPending && !session) { router.replace("/sign-in"); return; }
		if (session) { fetchMonitors(); fetchStatusPage(); }
	}, [session, isPending, router, fetchMonitors, fetchStatusPage]);

	useEffect(() => {
		const hasPending = monitors.some(m => m.status === "pending");
		if (!hasPending) return;
		const id = setInterval(fetchMonitors, 30_000);
		return () => clearInterval(id);
	}, [monitors, fetchMonitors]);

	async function handleSignOut() {
		await authClient.signOut();
		router.replace("/sign-in");
	}

	function normalizeUrl(raw: string) {
		const s = raw.trim();
		return s && !s.startsWith("http://") && !s.startsWith("https://") ? `https://${s}` : s;
	}

	async function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		setAddError(""); setAdding(true);
		const normalized = normalizeUrl(url);
		try {
			new URL(normalized);
		} catch {
			setAddError("Please enter a valid URL (e.g. https://example.com)");
			setAdding(false);
			return;
		}
		try {
			const res = await fetch("/api/monitors", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), url: normalized, interval: 60 }),
			});
			if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed");
			setName(""); setUrl("");
			await fetchMonitors();
		} catch (e) {
			setAddError(e instanceof Error ? e.message : "Could not add monitor.");
		} finally {
			setAdding(false);
		}
	}

	async function handleSaveStatusPage(e: React.FormEvent) {
		e.preventDefault();
		setSpError(""); setSpSaving(true); setSpSaved(false);
		try {
			const res = await fetch("/api/status-pages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug: spSlug, title: spTitle }),
			});
			const data = await res.json() as { slug?: string; title?: string; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Failed");
			setStatusPage({ slug: data.slug!, title: data.title! });
			setSpSaved(true);
			setTimeout(() => setSpSaved(false), 3000);
		} catch (e) {
			setSpError(e instanceof Error ? e.message : "Could not save.");
		} finally {
			setSpSaving(false);
		}
	}

	async function handleDelete(id: string) {
		if (!confirm("Delete this monitor?")) return;
		setDeleting(id);
		await fetch(`/api/monitors/${id}`, { method: "DELETE" });
		setDeleting(null);
		await fetchMonitors();
	}

	async function toggleResponseTimes(monitorId: string) {
		if (expandedMonitor === monitorId) {
			setExpandedMonitor(null);
			return;
		}
		setExpandedMonitor(monitorId);
		if (responseTimes[monitorId]) return;
		setLoadingRT(monitorId);
		try {
			const res = await fetch(`/api/monitors/${monitorId}/response-times?limit=20`);
			if (res.ok) {
				const data = await res.json() as CheckResult[];
				setResponseTimes(prev => ({ ...prev, [monitorId]: data }));
			}
		} finally {
			setLoadingRT(null);
		}
	}

	if (isPending) return null;

	return (
		<main style={{ minHeight: "100vh", padding: "40px 24px", maxWidth: 720, margin: "0 auto" }}>
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span style={{ fontSize: 28 }}>📡</span>
					<h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>PingWatch</h1>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<span style={{ color: "#666", fontSize: 14 }}>{session?.user?.email}</span>
					<button onClick={handleSignOut} style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
						Sign out
					</button>
				</div>
			</div>

			{/* Add monitor */}
			<div style={{ ...card, marginBottom: 28 }}>
				<h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: "#ccc" }}>Add Monitor</h2>
				<form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
					<input style={inp} placeholder="Name (e.g. My API)" required value={name} onChange={e => setName(e.target.value)} />
					<input style={inp} placeholder="URL (e.g. https://api.example.com)" required value={url} onChange={e => setUrl(e.target.value)} />
					<button type="submit" disabled={adding} style={{ padding: "10px 20px", borderRadius: 8, background: adding ? "#333" : "#fff", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 14, cursor: adding ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
						{adding ? "Adding…" : "+ Add"}
					</button>
				</form>
				{addError && <p style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{addError}</p>}
			</div>

			{/* Monitors list */}
			<h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: "#ccc" }}>
				Monitors {monitors.length > 0 && <span style={{ color: "#555" }}>({monitors.length})</span>}
			</h2>

			{loadingMonitors ? (
				<p style={{ color: "#555" }}>Loading…</p>
			) : monitors.length === 0 ? (
				<div style={{ ...card, textAlign: "center", padding: 40 }}>
					<p style={{ color: "#555", fontSize: 15 }}>No monitors yet. Add one above.</p>
				</div>
			) : (
				monitors.map(m => (
					<div key={m.id} style={card}>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
									<span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_DOT[m.status], display: "inline-block", flexShrink: 0 }} />
									<span style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
									<span style={{ fontSize: 11, fontWeight: 700, color: STATUS_DOT[m.status], background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 99 }}>{STATUS_LABEL[m.status]}</span>
									{m.monitorType === "http" && (
										<span style={{ fontSize: 11, color: "#888", background: "#1a1a1a", padding: "2px 8px", borderRadius: 99, border: "1px solid #2a2a2a" }}>HTTP</span>
									)}
									{m.sslExpiryAt && (() => {
										const daysLeft = (new Date(m.sslExpiryAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
										if (daysLeft <= 7) return <span style={{ fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: 99 }}>SSL {Math.ceil(daysLeft)}d</span>;
										if (daysLeft <= 14) return <span style={{ fontSize: 11, color: "#eab308", background: "rgba(234,179,8,0.1)", padding: "2px 8px", borderRadius: 99 }}>SSL {Math.ceil(daysLeft)}d</span>;
										return null;
									})()}
								</div>
								<p style={{ color: "#555", fontSize: 13, marginLeft: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.url}</p>
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
								<div style={{ textAlign: "center" }}>
									<p style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Uptime</p>
									<p style={{ fontSize: 14, fontWeight: 600 }}>{m.uptime.toFixed(1)}%</p>
								</div>
								{m.lastResponseTime !== null && (
									<div style={{ textAlign: "center" }}>
										<p style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>Response</p>
										<p style={{ fontSize: 14, fontWeight: 600 }}>{m.lastResponseTime}ms</p>
									</div>
								)}
								{m.monitorType === "http" && (
									<button
										onClick={() => toggleResponseTimes(m.id)}
										style={{ background: "none", border: "1px solid #2a2a2a", color: expandedMonitor === m.id ? "#ededed" : "#666", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}
									>
										{expandedMonitor === m.id ? "Hide" : "History"}
									</button>
								)}
								<button onClick={() => handleDelete(m.id)} disabled={deleting === m.id} style={{ background: "none", border: "1px solid #2a2a2a", color: "#666", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
									{deleting === m.id ? "…" : "Delete"}
								</button>
							</div>
						</div>
						{m.lastCheckedAt ? (
							<p style={{ color: "#444", fontSize: 12, marginTop: 10, marginLeft: 20 }}>
								Last checked {new Date(m.lastCheckedAt).toLocaleString()}
							</p>
						) : (
							<p style={{ color: "#555", fontSize: 12, marginTop: 10, marginLeft: 20 }}>
								First check within ~1 min…
							</p>
						)}
						{/* Response time history for HTTP monitors */}
						{expandedMonitor === m.id && (
							<div style={{ marginTop: 16, borderTop: "1px solid #1e1e1e", paddingTop: 14 }}>
								<p style={{ fontSize: 12, color: "#555", marginBottom: 10, marginLeft: 2 }}>Last 20 checks</p>
								{loadingRT === m.id ? (
									<p style={{ fontSize: 13, color: "#555" }}>Loading…</p>
								) : !responseTimes[m.id]?.length ? (
									<p style={{ fontSize: 13, color: "#555" }}>No check results yet.</p>
								) : (
									<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
										<thead>
											<tr style={{ color: "#555" }}>
												<th style={{ textAlign: "left", paddingBottom: 6, fontWeight: 500 }}>Time</th>
												<th style={{ textAlign: "right", paddingBottom: 6, fontWeight: 500 }}>Status</th>
												<th style={{ textAlign: "right", paddingBottom: 6, fontWeight: 500 }}>Code</th>
												<th style={{ textAlign: "right", paddingBottom: 6, fontWeight: 500 }}>Response</th>
											</tr>
										</thead>
										<tbody>
											{responseTimes[m.id].map((r, i) => (
												<tr key={i} style={{ borderTop: "1px solid #1a1a1a" }}>
													<td style={{ padding: "5px 0", color: "#666" }}>{new Date(r.checkedAt).toLocaleString()}</td>
													<td style={{ padding: "5px 0", textAlign: "right", color: r.status === "up" ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{r.status.toUpperCase()}</td>
													<td style={{ padding: "5px 0", textAlign: "right", color: "#888" }}>{r.statusCode ?? "—"}</td>
													<td style={{ padding: "5px 0", textAlign: "right", color: "#ededed" }}>{r.responseTimeMs !== null ? `${r.responseTimeMs}ms` : "—"}</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						)}
					</div>
				))
			)}

			{/* Status Page */}
			<div style={{ marginTop: 40, ...card }}>
				<h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#ccc" }}>Public Status Page</h2>
				<p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>Share a live status URL with your users.</p>

				{statusPage && (
					<div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
						<span style={{ color: "#22c55e", fontSize: 13, fontFamily: "monospace", wordBreak: "break-all" }}>
							pingwatch.vitalisnet.com/status/{statusPage.slug}
						</span>
						<div style={{ display: "flex", gap: 8 }}>
							<a href={`/status/${statusPage.slug}`} target="_blank" rel="noopener noreferrer"
								style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, textDecoration: "none" }}>
								View ↗
							</a>
							<button onClick={() => navigator.clipboard.writeText(`https://pingwatch.vitalisnet.com/status/${statusPage.slug}`)}
								style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
								Copy
							</button>
						</div>
					</div>
				)}

				<form onSubmit={handleSaveStatusPage} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
						<input style={{ ...inp, fontFamily: "monospace" }} placeholder="your-slug (e.g. acme-status)" value={spSlug}
							onChange={e => setSpSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
							pattern="[a-z0-9-]{3,40}" title="3–40 chars: lowercase letters, numbers, hyphens" required />
						<input style={inp} placeholder="Page title (e.g. Acme Status)" value={spTitle}
							onChange={e => setSpTitle(e.target.value)} required />
					</div>
					{spError && <p style={{ color: "#f87171", fontSize: 13 }}>{spError}</p>}
					{spSaved && <p style={{ color: "#22c55e", fontSize: 13 }}>Saved!</p>}
					<div>
						<button type="submit" disabled={spSaving}
							style={{ padding: "9px 20px", borderRadius: 8, background: spSaving ? "#333" : "#fff", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 14, cursor: spSaving ? "not-allowed" : "pointer" }}>
							{spSaving ? "Saving…" : statusPage ? "Update Status Page" : "Create Status Page"}
						</button>
					</div>
				</form>
			</div>
		</main>
	);
}
