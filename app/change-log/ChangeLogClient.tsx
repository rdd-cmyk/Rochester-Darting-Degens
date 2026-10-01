"use client";
import { PageHeader } from '@/components/ui/PageHeader';

import { ActionLink } from '@/components/ui/ActionLink';
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChangeLogMarkdown } from "./ChangeLogMarkdown";

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
const LOAD_ERROR_MESSAGE =
  "Unable to load change log right now. Please try again shortly.";

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
    let generation = 0;

    async function loadPulls() {
      const requestGeneration = ++generation;
      const current = () => isMounted && requestGeneration === generation;
      setPulls([]);
      setHasNextPage(false);
      setLoading(true);
      setErrorMessage(null);
      setAuthRequired(false);

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (!current()) return;
        if (sessionError) throw sessionError;

        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          setAuthRequired(true);
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/change-log?page=${page}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!current()) return;

        if (response.status === 401) {
          setAuthRequired(true);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { message?: string }
            | null;
          if (!current()) return;
          setErrorMessage(body?.message ?? LOAD_ERROR_MESSAGE);
          setLoading(false);
          return;
        }

        const body = (await response.json()) as PullResponse;
        if (!current()) return;
        setPulls(body.pulls);
        setHasNextPage(body.hasNextPage);
        setLoading(false);
      } catch {
        if (!current()) return;
        setErrorMessage(LOAD_ERROR_MESSAGE);
        setLoading(false);
      }
    }

    loadPulls();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Invalidate a pending response immediately, including another tab's
        // account change. Queue session reads outside Supabase's Auth callback.
        generation++;
        setPulls([]);
        setHasNextPage(false);
        setLoading(true);
        queueMicrotask(() => { if (isMounted) void loadPulls(); });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [page]);

  const hasPreviousPage = page > 1;
  const showPagination = hasPreviousPage || hasNextPage;

  const heading = (
    <PageHeader title="Change Log" size="standard" eyebrow="Site updates" description="The latest updates merged into main. See what’s new around the league." />
  );

  if (loading) {
    return (
      <main className="page-shell change-log-page change-log-consistent" aria-label="Change log">
        {heading}
        <div className="rdd-state" role="status">
          {LOADING_MESSAGE}
        </div>
      </main>
    );
  }

  if (authRequired) {
    return (
      <main className="page-shell change-log-page change-log-consistent" aria-label="Change log">
        {heading}
        <div className="rdd-state">
          Please sign in to view the change log.{" "}
          <ActionLink href="/auth">
            Go to sign in
          </ActionLink>
          .
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="page-shell change-log-page change-log-consistent" aria-label="Change log">
        {heading}
        <div className="rdd-state rdd-state--error" role="alert">
          {errorMessage.startsWith('Missing GitHub configuration')
            ? 'Change log is temporarily unavailable. Please try again later.'
            : errorMessage}
        </div>
      </main>
    );
  }

  const content =
    pulls.length === 0 ? (
      <div className="rdd-state">
        No merged pull requests found on this page.
      </div>
    ) : (
      <ul className="change-log-list">
        {pulls.map((pr) => (
          <li key={pr.id} className="change-log-card">
            <div className="change-log-card-header">
              <h2 className="change-log-card-title rdd-section-title">
                {pr.title}
              </h2>
              <time className="change-log-card-date" dateTime={pr.merged_at}>
                Merged {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(pr.merged_at))}
              </time>
            </div>
            {pr.summary ? (
              <ChangeLogMarkdown content={pr.summary} />
            ) : (
              <p className="change-log-empty">No summary provided.</p>
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <main className="page-shell change-log-page change-log-consistent" aria-label="Change log">
      {heading}
      {content}

      {showPagination && (
        <nav className="change-log-pagination" aria-label="Pagination controls">
          {hasPreviousPage ? (
            <ActionLink
              href={`/change-log?page=${page - 1}`}
              onClick={(event) => {
                event.preventDefault();
                router.push(`/change-log?page=${page - 1}`);
              }}
            >
              Previous
            </ActionLink>
          ) : (
            <span className="change-log-pagination-unavailable">Previous</span>
          )}
          <span className="change-log-pagination-page">
            Page {page}
          </span>
          {hasNextPage ? (
            <ActionLink
              href={`/change-log?page=${page + 1}`}
              onClick={(event) => {
                event.preventDefault();
                router.push(`/change-log?page=${page + 1}`);
              }}
            >
              Next
            </ActionLink>
          ) : (
            <span className="change-log-pagination-unavailable">Next</span>
          )}
        </nav>
      )}
    </main>
  );
}
