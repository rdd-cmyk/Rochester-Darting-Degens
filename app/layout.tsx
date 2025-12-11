import type { Metadata } from "next";
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
      </body>
    </html>
  );
}
