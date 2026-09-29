import type { Metadata } from "next";
import Observability from "./components/Observability";
import "./globals.css";
import LayoutShell from "./components/LayoutShell";
import { AvatarProvider } from '@/components/avatars/PlayerAvatar';
import '@/components/rivalries/rivalries.css';

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
      <body className="antialiased">
        <AvatarProvider><LayoutShell>{children}</LayoutShell></AvatarProvider>
        {/* Local synthetic acceptance must not load external telemetry scripts. */}
        {process.env.RDD_LOCAL_PREVIEW !== "1" && (
          <Observability />
        )}
      </body>
    </html>
  );
}
