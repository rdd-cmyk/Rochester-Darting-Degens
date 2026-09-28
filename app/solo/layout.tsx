import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Solo Play",
  description: "Personal practice games and solo-to-league performance trends.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
