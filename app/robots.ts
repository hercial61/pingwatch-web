import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: ["/", "/status/"],
				disallow: ["/dashboard", "/api/", "/sign-in", "/sign-up", "/admin", "/verify", "/success"],
			},
		],
	};
}
