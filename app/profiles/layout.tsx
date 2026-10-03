import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Players' };

export default function ProfilesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
