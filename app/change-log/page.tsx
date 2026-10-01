import { PageHeader } from '@/components/ui/PageHeader';
import type { Metadata } from "next";
import { Suspense } from "react";
import ChangeLogClient from "./ChangeLogClient";

export const metadata: Metadata = {
  title: "Change Log",
};

export default function ChangeLogPage() {
  return (
    <Suspense
      fallback={
        <main className="rdd-page-shell page-shell change-log-page change-log-consistent" aria-label="Change log">
          <PageHeader title="Change Log" eyebrow="Site updates" description="The latest updates merged into main. See what’s new around the league." />
          <div className="rdd-state" role="status">Loading change log...</div>
        </main>
      }
    >
      <ChangeLogClient />
    </Suspense>
  );
}
