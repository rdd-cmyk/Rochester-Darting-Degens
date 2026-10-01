import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsNavigation } from '@/components/stats/StatsNavigation';

export const metadata: Metadata = {
  title: 'Stats',
  description: 'Opponent-adjusted ratings, form, consistency, league records and head-to-head results.',
};

export default function StatsLayout({ children }: { children: ReactNode }) {
  return <main className="rdd-page-shell stats-page-shell">
    <PageHeader title="Stats" eyebrow="Rochester Darting Degens"
      description="The league picture, the records behind it, and the rivalries worth watching." />
    <StatsNavigation />
    {children}
  </main>;
}
