import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'League invitations | RDD', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function InvitesLayout({ children }: { children: React.ReactNode }) { return children; }
