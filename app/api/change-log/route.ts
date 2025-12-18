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
    sort: "updated",
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
  const mergedOnly = raw.filter((pr) => pr.merged_at);
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
