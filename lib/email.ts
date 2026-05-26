import { Resend } from "resend";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://pingwatch.vitalisnet.com";
const FROM = process.env.RESEND_FROM_EMAIL ?? "PingWatch <onboarding@resend.dev>";

function downHtml(name: string, url: string, time: string) {
	return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
<tr><td style="background:#ef4444;padding:24px 32px;">
<p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Outage Detected</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">${name} is down</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;">Your monitor detected that <strong style="color:#111;">${url}</strong> is not responding.</p>
<table cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;width:100%;margin-bottom:24px;">
<tr><td style="color:#888;font-size:13px;padding:4px 0;">Time detected</td><td style="color:#111;font-size:13px;font-weight:600;text-align:right;">${time}</td></tr>
</table>
<a href="${BASE}/dashboard" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;">View Dashboard →</a>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eee;background:#fafafa;">
<p style="margin:0;color:#aaa;font-size:12px;">Powered by <a href="${BASE}" style="color:#888;text-decoration:none;">PingWatch</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function upHtml(name: string, url: string, time: string, duration: string | null) {
	return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
<tr><td style="background:#22c55e;padding:24px 32px;">
<p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Recovered</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">${name} is back up</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;"><strong style="color:#111;">${url}</strong> is responding normally again.</p>
<table cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;width:100%;margin-bottom:24px;">
<tr><td style="color:#888;font-size:13px;padding:4px 0;">Recovered at</td><td style="color:#111;font-size:13px;font-weight:600;text-align:right;">${time}</td></tr>
${duration ? `<tr><td style="color:#888;font-size:13px;padding:4px 0;">Outage duration</td><td style="color:#111;font-size:13px;font-weight:600;text-align:right;">${duration}</td></tr>` : ""}
</table>
<a href="${BASE}/dashboard" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;">View Dashboard →</a>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eee;background:#fafafa;">
<p style="margin:0;color:#aaa;font-size:12px;">Powered by <a href="${BASE}" style="color:#888;text-decoration:none;">PingWatch</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function formatDuration(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	const h = Math.floor(m / 60);
	return `${h}h ${m % 60}m`;
}

export async function sendDownAlert(to: string, monitorName: string, monitorUrl: string, detectedAt: number): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) return;
	const time = new Date(detectedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
	try {
		const resend = new Resend(apiKey);
		await resend.emails.send({
			from: FROM,
			to,
			subject: `🔴 ${monitorName} is down`,
			html: downHtml(monitorName, monitorUrl, time),
		});
	} catch {
		// email is best-effort
	}
}

const CX_FROM = process.env.RESEND_FROM_EMAIL ?? "PingWatch <onboarding@resend.dev>";

function welcomeHtml() {
	return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
<tr><td style="background:#111;padding:24px 32px;">
<p style="margin:0;color:#aaa;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">PingWatch Pro</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">You're all set.</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;">Thanks for subscribing to <strong style="color:#111;">PingWatch Pro</strong>. Your account is active and monitoring is ready to go.</p>
<p style="margin:0 0 8px;color:#111;font-size:14px;font-weight:600;">What's included:</p>
<ul style="margin:0 0 24px;padding-left:20px;color:#555;font-size:14px;line-height:1.8;">
<li>Unlimited monitors with 1-minute checks</li>
<li>Email alerts the moment a site goes down or recovers</li>
<li>Public status pages to share uptime with your users</li>
</ul>
<a href="${BASE}/dashboard" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;">Go to Dashboard →</a>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eee;background:#fafafa;">
<p style="margin:0;color:#aaa;font-size:12px;">Questions? Reply to this email. Powered by <a href="${BASE}" style="color:#888;text-decoration:none;">PingWatch</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function winbackHtml() {
	return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
<tr><td style="background:#111;padding:24px 32px;">
<p style="margin:0;color:#aaa;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">We noticed you cancelled</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">Sorry to see you go.</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;">Your Pro subscription has been cancelled. Your monitors will stay active until your billing period ends, then revert to free-tier limits.</p>
<p style="margin:0 0 8px;color:#111;font-size:14px;font-weight:600;">What you'll lose:</p>
<ul style="margin:0 0 24px;padding-left:20px;color:#555;font-size:14px;line-height:1.8;">
<li>1-minute check intervals (back to 5-minute)</li>
<li>Email alerts for downtime events</li>
<li>Public status pages</li>
</ul>
<p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">Changed your mind? You can reactivate anytime — your monitor history stays intact.</p>
<a href="${BASE}/dashboard" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;">Reactivate Pro →</a>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eee;background:#fafafa;">
<p style="margin:0;color:#aaa;font-size:12px;">Powered by <a href="${BASE}" style="color:#888;text-decoration:none;">PingWatch</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function sendWelcomeEmail(to: string): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) return;
	try {
		const resend = new Resend(apiKey);
		await resend.emails.send({
			from: CX_FROM,
			to,
			subject: "Welcome to PingWatch Pro",
			html: welcomeHtml(),
		});
	} catch {
		// email is best-effort
	}
}

export async function sendWinbackEmail(to: string): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) return;
	try {
		const resend = new Resend(apiKey);
		await resend.emails.send({
			from: CX_FROM,
			to,
			subject: "We're sorry to see you go — PingWatch Pro cancelled",
			html: winbackHtml(),
		});
	} catch {
		// email is best-effort
	}
}

export async function sendUpAlert(to: string, monitorName: string, monitorUrl: string, recoveredAt: number, durationMs: number | null): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) return;
	const time = new Date(recoveredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
	try {
		const resend = new Resend(apiKey);
		await resend.emails.send({
			from: FROM,
			to,
			subject: `✅ ${monitorName} is back up`,
			html: upHtml(monitorName, monitorUrl, time, durationMs !== null ? formatDuration(durationMs) : null),
		});
	} catch {
		// email is best-effort
	}
}
