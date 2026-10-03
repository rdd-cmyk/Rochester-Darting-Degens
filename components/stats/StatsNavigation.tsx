'use client';
import { ActionLink } from '@/components/ui/ActionLink';
import { usePathname } from 'next/navigation';

const views = [['/stats', 'Power & Performance'], ['/stats/records', 'Records'], ['/stats/head-to-head', 'Head to Head']] as const;
export function StatsNavigation() {
  const pathname = usePathname();
  return <nav className="rdd-view-navigation" aria-label="Statistics views">
    {views.map(([href, label]) => <ActionLink
      key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</ActionLink>)}
  </nav>;
}
