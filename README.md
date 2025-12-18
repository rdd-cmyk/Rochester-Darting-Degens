This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration

This project relies on Supabase for authentication and data. Create a `.env.local` file in the project root and add the following environment variables before running the app:

```bash
NEXT_PUBLIC_SUPABASE_URL="<your Supabase project URL>"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<your Supabase anon/public API key>"
GITHUB_TOKEN="<a GitHub personal access token with read access to the target repo>"
GITHUB_REPO_OWNER="<GitHub org or username>"
GITHUB_REPO_NAME="<repository name>"
```

`GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, and `GITHUB_REPO_NAME` are required for the Change Log page (`/change-log`), which lists merged pull requests from the configured repository. Responses are cached for 15 minutes (see `revalidate` in `app/change-log/page.tsx`) to reduce API calls. If you expect a high volume of requests, consider using a token that benefits from higher GitHub rate limits.

On Vercel, set these environment variables (without the `NEXT_PUBLIC_` prefix) in your project settings so they remain server-only and are available during build and at runtime.

If you do not have a Supabase project yet, create one at [supabase.com](https://supabase.com), then copy the project URL and anon key from Project Settings → API.

## Getting Started

First, install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
