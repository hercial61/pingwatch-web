export const dynamic = "force-dynamic";
import { type NextRequest, NextResponse } from "next/server";

const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID ?? "368503";
const LIFETIME_VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID ?? "1682964";
const MONTHLY_VARIANT_ID = process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID ?? "1643372";
const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

export async function POST(req: NextRequest) {
	if (!API_KEY) {
		return NextResponse.json({ error: "LEMONSQUEEZY_API_KEY not set" }, { status: 500 });
	}

	let email: string | undefined;
	let plan: "monthly" | "lifetime" = "lifetime";
	try {
		const body = (await req.json()) as { email?: string; plan?: string };
		email = body.email?.trim() || undefined;
		if (body.plan === "monthly") plan = "monthly";
	} catch {
		// email and plan are optional, continue with defaults
	}

	const variantId = plan === "monthly" ? MONTHLY_VARIANT_ID : LIFETIME_VARIANT_ID;
	if (!variantId) {
		return NextResponse.json(
			{ error: `LEMONSQUEEZY_MONTHLY_VARIANT_ID is not configured` },
			{ status: 500 },
		);
	}

	const successUrl = BASE_URL ? `${BASE_URL}/success` : undefined;

	const attributes: Record<string, unknown> = {
		checkout_data: {
			...(email ? { email } : {}),
		},
	};

	if (successUrl) {
		attributes.product_options = { redirect_url: successUrl };
	}

	const payload = {
		data: {
			type: "checkouts",
			attributes,
			relationships: {
				store: { data: { type: "stores", id: String(STORE_ID) } },
				variant: { data: { type: "variants", id: String(variantId) } },
			},
		},
	};

	const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${API_KEY}`,
			Accept: "application/vnd.api+json",
			"Content-Type": "application/vnd.api+json",
		},
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const err = await res.text();
		return NextResponse.json({ error: err }, { status: res.status });
	}

	const data = (await res.json()) as { data: { attributes: { url: string } } };
	return NextResponse.json({ url: data.data.attributes.url });
}
