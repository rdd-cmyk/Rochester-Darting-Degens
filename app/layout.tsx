import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import LayoutShell from "./components/LayoutShell";

export const metadata: Metadata = {
  title: {
    default: "RDD - Home",
    template: "RDD - %s",
  },
  description: "Rochester Darting Degens stats and match tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <LayoutShell>{children}</LayoutShell>
        {/* Local synthetic acceptance must not load external telemetry scripts. */}
        {process.env.RDD_LOCAL_PREVIEW !== "1" && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
