export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getRevenueSummary } from "@/lib/revenue";

const FROM = process.env.RESEND_FROM_EMAIL ?? "PingWatch <onboarding@resend.dev>";

function fmt(cents: number) {
	return `$${(cents / 100).toFixed(2)}`;
}

function pct(n: number) {
	return `${(n * 100).toFixed(1)}%`;
}

function digestHtml(date: string, mrr: string, active: number, newSubs: number, cancellations: number, churnRate: string) {
	return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
<tr><td style="background:#111;padding:24px 32px;">
<p style="margin:0;color:#aaa;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Weekly Health Digest</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">PingWatch — ${date}</h1>
</td></tr>
<tr><td style="padding:32px;">
<table cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px;width:100%;">
<tr>
  <td style="color:#888;font-size:13px;padding:6px 0;">MRR</td>
  <td style="color:#111;font-size:15px;font-weight:700;text-align:right;">${mrr}</td>
</tr>
<tr>
  <td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee;">Active subscribers</td>
  <td style="color:#111;font-size:15px;font-weight:700;text-align:right;">${active}</td>
</tr>
<tr>
  <td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee;">New this month</td>
  <td style="color:#22c55e;font-size:15px;font-weight:700;text-align:right;">+${newSubs}</td>
</tr>
<tr>
  <td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee;">Cancellations this month</td>
  <td style="color:#ef4444;font-size:15px;font-weight:700;text-align:right;">${cancellations}</td>
</tr>
<tr>
  <td style="color:#888;font-size:13px;padding:6px 0;border-top:1px solid #eee;">Churn rate (monthly)</td>
  <td style="color:#111;font-size:15px;font-weight:700;text-align:right;">${churnRate}</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eee;background:#fafafa;">
<p style="margin:0;color:#aaa;font-size:12px;">PingWatch CX — automated weekly digest</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });

	const auth = req.headers.get("authorization") ?? "";
	if (auth !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	const boardEmail = process.env.BOARD_DIGEST_EMAIL;
	if (!boardEmail) return NextResponse.json({ error: "BOARD_DIGEST_EMAIL not configured" }, { status: 500 });

	const resendKey = process.env.RESEND_API_KEY;
	if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

	const dbUrl = process.env.TURSO_DATABASE_URL;
	const dbToken = process.env.TURSO_AUTH_TOKEN;
	if (!dbUrl || !dbToken) return NextResponse.json({ error: "db not configured" }, { status: 500 });

	const summary = await getRevenueSummary(dbUrl, dbToken);

	const date = new Date().toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});

	const html = digestHtml(
		date,
		fmt(summary.currentMrrCents),
		summary.activeCount,
		summary.newThisMonth,
		summary.cancellationsThisMonth,
		pct(summary.churnRate),
	);

	const resend = new Resend(resendKey);
	await resend.emails.send({
		from: FROM,
		to: boardEmail,
		subject: `PingWatch Weekly Digest — ${date}`,
		html,
	});

	return NextResponse.json({ ok: true, date, mrr: fmt(summary.currentMrrCents) });
}
