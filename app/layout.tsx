import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PingWatch — Uptime Monitoring",
  description: "Get instant alerts when your sites go down. Lifetime Pro access — one payment, forever.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #ededed; line-height: 1.6; }
          a { color: inherit; text-decoration: none; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
