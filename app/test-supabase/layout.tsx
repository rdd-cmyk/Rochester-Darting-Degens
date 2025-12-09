import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test Supabase",
};

export default function TestSupabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
