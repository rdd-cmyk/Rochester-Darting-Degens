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
        <main className="page-shell change-log-page" aria-labelledby="change-log-heading">
          <header className="rdd-page-header rdd-page-header--compact">
            <p className="rdd-eyebrow">Site updates</p>
            <h1 id="change-log-heading">Change Log</h1>
            <p>Latest merged pull requests. Results refresh periodically to reduce API calls.</p>
          </header>
          <div className="rdd-state" role="status">Loading change log...</div>
        </main>
      }
    >
      <ChangeLogClient />
    </Suspense>
  );
}
