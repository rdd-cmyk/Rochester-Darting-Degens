import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'League Board | Rochester Darting Degens',
  description: 'The members-only Rochester Darting Degens league board.',
  robots: { index: false, follow: false },
};
export default function BoardLayout({ children }: { children: React.ReactNode }) { return children; }
