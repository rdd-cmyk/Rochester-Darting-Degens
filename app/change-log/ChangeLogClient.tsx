"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PullRequestSummary = {
  id: number;
  title: string;
  merged_at: string;
  summary: string | null;
};

type PullResponse = {
  pulls: PullRequestSummary[];
  hasNextPage: boolean;
  errorMessage?: string;
};

const LOADING_MESSAGE = "Loading change log...";

export default function ChangeLogClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = useMemo(() => {
    const fromQuery = Number(searchParams.get("page") || "1");
    return Number.isFinite(fromQuery) && fromQuery > 0 ? Math.floor(fromQuery) : 1;
  }, [searchParams]);

  const [pulls, setPulls] = useState<PullRequestSummary[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPulls() {
      setLoading(true);
      setErrorMessage(null);
      setAuthRequired(false);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        if (!isMounted) return;
        setAuthRequired(true);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/change-log?page=${page}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!isMounted) return;

      if (response.status === 401) {
        setAuthRequired(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setErrorMessage(
          body?.message ??
            "Unable to load change log right now. Please try again shortly."
        );
        setLoading(false);
        return;
      }

      const body = (await response.json()) as PullResponse;
      setPulls(body.pulls);
      setHasNextPage(body.hasNextPage);
      setLoading(false);
    }

    loadPulls();

    return () => {
      isMounted = false;
    };
  }, [page]);

  const hasPreviousPage = page > 1;
  const showPagination = hasPreviousPage || hasNextPage;

  const heading = (
    <div className="section-stack">
      <div>
        <p className="leaderboard-title" id="change-log-heading">
          Change Log
        </p>
        <p style={{ color: "var(--muted-foreground)", marginTop: "0.35rem" }}>
          Latest merged pull requests. Results refresh periodically to reduce
          API calls.
        </p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <main className="page-shell" aria-labelledby="change-log-heading">
        {heading}
        <div
          style={{
            padding: "1rem",
            backgroundColor: "var(--panel-bg)",
            border: `1px solid var(--panel-border)`,
            borderRadius: "0.75rem",
            color: "var(--muted-foreground)",
          }}
        >
          {LOADING_MESSAGE}
        </div>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="page-shell" aria-labelledby="change-log-heading">
        {heading}
        <div
          style={{
            padding: "1rem",
            backgroundColor: "var(--panel-bg)",
            border: `1px solid var(--panel-border)`,
            borderRadius: "0.75rem",
          }}
        >
          Please sign in to view the change log.{" "}
          <Link href="/auth" style={{ color: "var(--link-color)" }}>
            Go to sign in
          </Link>
          .
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="page-shell" aria-labelledby="change-log-heading">
        {heading}
        <div
          role="alert"
          style={{
            padding: "1rem",
            backgroundColor: "rgba(248, 113, 113, 0.12)",
            border: "1px solid rgba(248, 113, 113, 0.5)",
            borderRadius: "0.75rem",
            color: "#7f1d1d",
          }}
        >
          {errorMessage}
        </div>
      </main>
    );
  }

  const content =
    pulls.length === 0 ? (
      <div
        style={{
          padding: "1rem",
          backgroundColor: "var(--panel-bg)",
          border: `1px solid var(--panel-border)`,
          borderRadius: "0.75rem",
        }}
      >
        No merged pull requests found on this page. Try the next page if
        available.
      </div>
    ) : (
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {pulls.map((pr) => (
          <li
            key={pr.id}
            style={{
              padding: "1rem",
              borderRadius: "0.9rem",
              border: `1px solid var(--panel-border)`,
              backgroundColor: "var(--panel-bg)",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.03)",
              display: "grid",
              gap: "0.4rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <p
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--foreground)",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {pr.title}
              </p>
              <span
                style={{
                  color: "var(--muted-foreground)",
                  fontSize: "0.95rem",
                  whiteSpace: "nowrap",
                }}
              >
                Merged {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(pr.merged_at))}
              </span>
            </div>
            <div
              style={{
                color: "var(--muted-foreground)",
                fontSize: "0.95rem",
                whiteSpace: "pre-line",
                marginTop: "0.35rem",
              }}
            >
              {pr.summary ?? "No summary provided."}
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <main className="page-shell" aria-labelledby="change-log-heading">
      {heading}
      {content}

      {showPagination && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            marginTop: "0.75rem",
            alignItems: "center",
          }}
          aria-label="Pagination controls"
        >
          {hasPreviousPage ? (
            <Link
              href={`/change-log?page=${page - 1}`}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "0.65rem",
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--panel-bg)",
              }}
              onClick={(event) => {
                event.preventDefault();
                router.push(`/change-log?page=${page - 1}`);
              }}
            >
              Previous
            </Link>
          ) : (
            <span style={{ color: "var(--muted-foreground)" }}>Previous</span>
          )}
          <span
            style={{
              color: "var(--muted-foreground)",
              fontSize: "0.95rem",
            }}
          >
            Page {page}
          </span>
          {hasNextPage ? (
            <Link
              href={`/change-log?page=${page + 1}`}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "0.65rem",
                border: "1px solid var(--panel-border)",
                backgroundColor: "var(--panel-bg)",
              }}
              onClick={(event) => {
                event.preventDefault();
                router.push(`/change-log?page=${page + 1}`);
              }}
            >
              Next
            </Link>
          ) : (
            <span style={{ color: "var(--muted-foreground)" }}>Next</span>
          )}
        </div>
      )}
    </main>
  );
}
