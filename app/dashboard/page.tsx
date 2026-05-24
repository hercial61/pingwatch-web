"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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

	const fetchMonitors = useCallback(async () => {
		const res = await fetch("/api/monitors");
		if (res.ok) setMonitors(await res.json() as Monitor[]);
		setLoadingMonitors(false);
	}, []);

	useEffect(() => {
		if (!isPending && !session) { router.replace("/sign-in"); return; }
		if (session) fetchMonitors();
	}, [session, isPending, router, fetchMonitors]);

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
		try {
			const res = await fetch("/api/monitors", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), url: normalizeUrl(url), interval: 60 }),
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

	async function handleDelete(id: string) {
		if (!confirm("Delete this monitor?")) return;
		setDeleting(id);
		await fetch(`/api/monitors/${id}`, { method: "DELETE" });
		setDeleting(null);
		await fetchMonitors();
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
								<button onClick={() => handleDelete(m.id)} disabled={deleting === m.id} style={{ background: "none", border: "1px solid #2a2a2a", color: "#666", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
									{deleting === m.id ? "…" : "Delete"}
								</button>
							</div>
						</div>
						{m.lastCheckedAt && (
							<p style={{ color: "#444", fontSize: 12, marginTop: 10, marginLeft: 20 }}>
								Last checked {new Date(m.lastCheckedAt).toLocaleString()}
							</p>
						)}
					</div>
				))
			)}
		</main>
	);
}
