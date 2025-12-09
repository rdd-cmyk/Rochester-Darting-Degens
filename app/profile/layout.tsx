import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
};

export default function UserProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
