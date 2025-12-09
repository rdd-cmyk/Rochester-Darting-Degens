import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Matches",
};

export default function MatchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
