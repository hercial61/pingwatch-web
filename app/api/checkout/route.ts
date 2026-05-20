import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID ?? "368503";
const VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID ?? "1048000";
const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const SUCCESS_URL = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/success`
  : undefined;

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: "LEMONSQUEEZY_API_KEY not set" }, { status: 500 });
  }

  let email: string | undefined;
  try {
    const body = await req.json() as { email?: string };
    email = body.email?.trim() || undefined;
  } catch {
    // email is optional, continue without it
  }

  const attributes: Record<string, unknown> = {
    checkout_data: {
      ...(email ? { email } : {}),
    },
  };

  if (SUCCESS_URL) {
    attributes.product_options = { redirect_url: SUCCESS_URL };
  }

  const payload = {
    data: {
      type: "checkouts",
      attributes,
      relationships: {
        store: { data: { type: "stores", id: String(STORE_ID) } },
        variant: { data: { type: "variants", id: String(VARIANT_ID) } },
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

  const data = await res.json() as { data: { attributes: { url: string } } };
  return NextResponse.json({ url: data.data.attributes.url });
}
