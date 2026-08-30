import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advanced Stats',
  description: 'Opponent-adjusted ratings, form, consistency, and league stories.',
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
