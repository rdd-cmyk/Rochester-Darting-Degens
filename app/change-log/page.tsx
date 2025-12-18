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
        <main className="page-shell" aria-labelledby="change-log-heading">
          <div className="section-stack">
            <div>
              <p className="leaderboard-title" id="change-log-heading">
                Change Log
              </p>
              <p style={{ color: "var(--muted-foreground)", marginTop: "0.35rem" }}>
                Loading change log...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <ChangeLogClient />
    </Suspense>
  );
}
