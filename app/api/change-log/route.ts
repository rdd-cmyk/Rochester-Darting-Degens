import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PER_PAGE = 15;
const { GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME } = process.env;
const GITHUB_REVALIDATE_SECONDS = 900;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "development-anon-key";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type GitHubPullRequest = {
  id: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  base: { ref: string };
};

type PullRequestResponse = {
  pulls: {
    id: number;
    title: string;
    merged_at: string;
    summary: string | null;
  }[];
  hasNextPage: boolean;
};

function visualFixture(page: number): PullRequestResponse {
  // Invented, fixed records for the opt-in loopback preview only.
  if (page === 1) {
    return {
      pulls: [
        {
          id: 9001,
          title: "Clearer standings and match entry",
          merged_at: "2026-08-30T15:00:00Z",
          summary: "### Highlights\n\n- Compare the **overall standings** before opening the detailed `/stats` view.\n- Record a match with clearly labeled player scores and a visible winner.\n\n| Area | Update |\n| --- | --- |\n| Home | Easier table reading |\n| Matches | Clearer form groups |",
        },
        {
          id: 9002,
          title: "Player directory and history improvements",
          merged_at: "2026-08-20T15:00:00Z",
          summary: null,
        },
      ],
      hasNextPage: true,
    };
  }
  if (page === 2) {
    return {
      pulls: [{
        id: 9003,
        title: "Long-form league release notes for narrow screens",
        merged_at: "2026-08-10T15:00:00Z",
        summary: "A longer paragraph checks how release notes wrap when a change needs more than one short sentence. The wording is invented for the local preview and makes no claim about a real league release.\n\n```text\nsynthetic-change-log-example-with-a-long-unbroken-identifier-for-overflow-review\n```\n\n![Untrusted example](https://example.invalid/tracker.png)",
      }],
      hasNextPage: false,
    };
  }
  return { pulls: [], hasNextPage: false };
}

function isLoopbackVisualPreview(request: NextRequest): boolean {
  return process.env.RDD_VISUAL_FIXTURE === "1" &&
    process.env.RDD_LOCAL_PREVIEW === "1" &&
    ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname) &&
    ["localhost", "127.0.0.1"].includes(new URL(supabaseUrl).hostname);
}

function parseHasNextPage(linkHeader: string | null): boolean {
  if (!linkHeader) return false;

  return linkHeader
    .split(",")
    .map((value) => value.trim())
    .some((entry) => entry.includes('rel="next"'));
}

function getSummary(body: string | null) {
  if (!body) return null;
  const trimmed = body.trim();
  if (!trimmed) return null;

  const testingHeaderIndex = trimmed.search(/\n#{1,6}\s*Testing\b/i);
  const summarySection =
    testingHeaderIndex >= 0 ? trimmed.slice(0, testingHeaderIndex) : trimmed;

  const filtered = summarySection
    .split(/\r?\n/)
    .filter((line) => !/codex/i.test(line))
    .join("\n")
    .trim();

  return filtered || null;
}

async function fetchMergedPullRequests(
  page: number
): Promise<PullRequestResponse> {
  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
    throw new Error(
      "Missing GitHub configuration. Please set GITHUB_TOKEN, GITHUB_REPO_OWNER, and GITHUB_REPO_NAME."
    );
  }

  const params = new URLSearchParams({
    state: "closed",
    base: "main",
    sort: "created",
    direction: "desc",
    per_page: String(PER_PAGE),
    page: String(page),
  });

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/pulls?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "RDD-Change-Log",
      },
      next: { revalidate: GITHUB_REVALIDATE_SECONDS },
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(
      body?.message ??
        `GitHub API returned ${response.status}. Please try again shortly.`
    );
  }

  const raw = (await response.json()) as GitHubPullRequest[];
  const mergedOnly = raw.filter((pr) => pr.merged_at && pr.base?.ref === "main");
  const hasNextPage = parseHasNextPage(response.headers.get("link"));

  return {
    pulls: mergedOnly.map((pr) => ({
      id: pr.id,
      title: pr.title,
      merged_at: pr.merged_at as string,
      summary: getSummary(pr.body),
    })),
    hasNextPage,
  };
}

export async function GET(request: NextRequest) {
  const pageParam = Number(request.nextUrl.searchParams.get("page") || "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(
    token
  );

  if (authError || !authData.user) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 }
    );
  }

  if (isLoopbackVisualPreview(request)) {
    return NextResponse.json(visualFixture(page), { status: 200 });
  }

  // Auth validity alone is not league admission. Check the caller on every
  // request before consulting shared GitHub caches or returning private notes.
  const memberClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const membership = await memberClient.rpc('league_is_member').then(
    (result) => result,
    () => ({ data: null, error: true }),
  );
  if (membership.error) {
    return NextResponse.json({ message: 'Unable to verify league access.' }, { status: 503 });
  }
  if (membership.data !== true) {
    return NextResponse.json({ message: 'League membership required.' }, { status: 403 });
  }

  try {
    const payload = await fetchMergedPullRequests(page);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to load change log right now.",
      },
      { status: 500 }
    );
  }
}
