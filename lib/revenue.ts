import { tursoExecute } from "@/lib/turso";

const MONTHLY_PRICE_CENTS = 900; // $9/mo — matches LEMONSQUEEZY_MONTHLY_VARIANT_ID plan

export type RevenueSummary = {
	currentMrrCents: number;
	activeCount: number;
	newThisMonth: number;
	cancellationsThisMonth: number;
	churnRate: number;
	mrrByMonth: { month: string; mrrCents: number }[];
};

type SubRow = {
	subscription_id: string;
	status: string;
	created_at: number;
	ends_at: number | null;
};

function parseRows(rows: { type: string; value?: string }[][]): SubRow[] {
	return rows.map((r) => ({
		subscription_id: r[0]?.value ?? "",
		status: r[1]?.value ?? "",
		created_at: parseInt(r[2]?.value ?? "0", 10),
		ends_at: r[3]?.type === "null" ? null : parseInt(r[3]?.value ?? "0", 10),
	}));
}

function monthBounds(year: number, month: number) {
	const start = new Date(year, month, 1).getTime();
	const end = new Date(year, month + 1, 1).getTime() - 1;
	return { start, end };
}

function monthLabel(year: number, month: number) {
	return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export async function getRevenueSummary(
	dbUrl: string,
	dbToken: string,
): Promise<RevenueSummary> {
	let subs: SubRow[] = [];
	try {
		const result = await tursoExecute(
			dbUrl,
			dbToken,
			"SELECT subscription_id, status, created_at, ends_at FROM pingwatch_subscriptions",
		);
		subs = parseRows(result.rows as { type: string; value?: string }[][]);
	} catch {
		// table may not exist yet — return zero state
	}

	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
	const endOfMonth =
		new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;

	const activeCount = subs.filter((s) => s.status === "active" || s.status === "on_trial").length;

	const newThisMonth = subs.filter((s) => s.created_at >= startOfMonth).length;

	const cancellationsThisMonth = subs.filter(
		(s) =>
			(s.status === "cancelled" || s.status === "expired") &&
			(s.ends_at !== null ? s.ends_at >= startOfMonth && s.ends_at <= endOfMonth : false),
	).length;

	const churnBase = activeCount + cancellationsThisMonth;
	const churnRate = churnBase > 0 ? cancellationsThisMonth / churnBase : 0;

	// Last 6 months: count subs that were active during each month
	const mrrByMonth: { month: string; mrrCents: number }[] = [];
	for (let i = 5; i >= 0; i--) {
		let y = now.getFullYear();
		let m = now.getMonth() - i;
		while (m < 0) {
			m += 12;
			y -= 1;
		}
		const { start, end } = monthBounds(y, m);
		const activeInMonth = subs.filter(
			(s) =>
				s.created_at <= end &&
				(s.ends_at === null || s.ends_at > start),
		).length;
		mrrByMonth.push({ month: monthLabel(y, m), mrrCents: activeInMonth * MONTHLY_PRICE_CENTS });
	}

	return {
		currentMrrCents: activeCount * MONTHLY_PRICE_CENTS,
		activeCount,
		newThisMonth,
		cancellationsThisMonth,
		churnRate,
		mrrByMonth,
	};
}
