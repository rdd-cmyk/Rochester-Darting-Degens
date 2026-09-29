import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "The Rivalry Room",
  description: "Find your rival. Write the next chapter.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "The Rivalry Room",
    description: "Recorded league rivalries at Rochester Darting Degens.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
