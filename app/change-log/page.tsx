import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 900;

const REVALIDATE_SECONDS = revalidate;
const PER_PAGE = 15;

export const metadata: Metadata = {
  title: "Change Log",
};

const {
  GITHUB_TOKEN,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME,
} = process.env;

type GitHubPullRequest = {
  id: number;
  title: string;
  body: string | null;
  merged_at: string | null;
};

type PullRequestResult = {
  pulls: GitHubPullRequest[];
  hasNextPage: boolean;
  owner?: string | null;
  repo?: string | null;
  errorMessage?: string;
};

type ChangeLogPageProps = {
  searchParams?: {
    page?: string;
  };
};

function parseHasNextPage(linkHeader: string | null): boolean {
  if (!linkHeader) return false;

  return linkHeader
    .split(",")
    .map((value) => value.trim())
    .some((entry) => entry.includes('rel="next"'));
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

async function fetchMergedPullRequests(page: number): Promise<PullRequestResult> {
  const token = GITHUB_TOKEN;
  const owner = GITHUB_REPO_OWNER;
  const repo = GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    return {
      pulls: [],
      hasNextPage: false,
      owner,
      repo,
      errorMessage:
        "Missing GitHub configuration. Please set GITHUB_TOKEN, GITHUB_REPO_OWNER, and GITHUB_REPO_NAME in your environment.",
    };
  }

  const params = new URLSearchParams({
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: String(PER_PAGE),
    page: String(page),
  });

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RDD-Change-Log",
      },
      next: { revalidate: REVALIDATE_SECONDS },
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    return {
      pulls: [],
      hasNextPage: false,
      owner,
      repo,
      errorMessage:
        body?.message ??
        `GitHub API returned ${response.status}. Please try again shortly.`,
    };
  }

  const raw = (await response.json()) as GitHubPullRequest[];
  const mergedOnly = raw.filter((pr) => pr.merged_at);
  const hasNextPage = parseHasNextPage(response.headers.get("link"));

  return { pulls: mergedOnly, hasNextPage, owner, repo };
}

export default async function ChangeLogPage({
  searchParams,
}: ChangeLogPageProps) {
  const page = Math.max(Number(searchParams?.page ?? "1") || 1, 1);
  const { pulls, hasNextPage, errorMessage, owner, repo } =
    await fetchMergedPullRequests(page);

  const repoLabel =
    owner && repo ? `${owner}/${repo}` : "the configured repository";
  const hasPreviousPage = page > 1;

  return (
    <main className="page-shell" aria-labelledby="change-log-heading">
      <div className="section-stack">
        <div>
          <p className="leaderboard-title" id="change-log-heading">
            Change Log
          </p>
          <p style={{ color: "var(--muted-foreground)", marginTop: "0.35rem" }}>
            Latest merged pull requests for {repoLabel}. Results refresh every
            {Math.round(REVALIDATE_SECONDS / 60)} minutes to reduce API calls.
          </p>
        </div>
      </div>

      {errorMessage ? (
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
      ) : pulls.length === 0 ? (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "var(--panel-bg)",
            border: `1px solid var(--panel-border)`,
            borderRadius: "0.75rem",
          }}
        >
          No merged pull requests found.
        </div>
      ) : (
        <>
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
                    Merged {formatDate(pr.merged_at as string)}
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
                  {pr.body?.trim() || "No summary provided."}
                </div>
              </li>
            ))}
          </ul>

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
              >
                Next
              </Link>
            ) : (
              <span style={{ color: "var(--muted-foreground)" }}>Next</span>
            )}
          </div>
        </>
      )}
    </main>
  );
}
