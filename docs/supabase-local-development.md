# Supabase Local Development

Status: repository tooling initialized; Docker Desktop activation and hosted
authentication remain pending

Supabase project: `hrqsbzmsfichiimtxijj`

Last reviewed: 2026-08-30

## Tooling contract

- Use npm and the checked-in `package-lock.json`.
- The Supabase CLI is pinned as a development dependency. Run it through the
  package scripts so contributors use the repository version.
- The local Supabase stack requires Docker Desktop or another compatible
  Docker runtime.
- Never commit access tokens, database passwords, service-role keys, or local
  environment files.

## Machine setup

This setup was verified with Node.js `24.19.0` and npm `11.17.0`. Package 3A of
the dependency-modernization plan establishes the formal supported runtime and
package-manager contract. After Docker Desktop is installed, launch it once and
complete its Windows setup. A reboot may be required when Windows enables WSL 2
or virtualization features.

Verify the machine layer before starting Supabase:

```powershell
node --version
npm --version
docker version
npm run supabase -- --version
```

## Local stack

Start, inspect, and stop the repository-local services with:

```powershell
npm run supabase:start
npm run supabase:status
npm run supabase:stop
```

The first start downloads Supabase container images and can take several
minutes. It applies migrations under `supabase/migrations/` only to the local
database.

After the stack starts, copy the local API URL and its publishable key (or
legacy anon key) from `npm run supabase:status` into the root `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local publishable or anon key>
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

Only use the local public client key here, never the secret or service-role
key. The environment file is ignored by Git. Restart the Next.js development
server after changing it so authentication and password-reset redirects use the
local stack.

The generated `supabase/config.toml` currently uses the CLI's default Postgres
major version. Compare that value with the hosted project before treating local
migration rehearsal as representative.

The experimental pg-delta schema-diff engine is disabled. Do not enable it for
`db diff`, `db pull`, or remote comparison until the project evaluates and tests
its generated SQL.

## Hosted authentication and linking

Complete these steps only while the project member is present:

```powershell
npm run supabase -- login
npm run supabase -- link --project-ref hrqsbzmsfichiimtxijj
```

Use the browser login flow and enter any requested database password directly
at the local prompt. Do not paste credentials into chat or save them in tracked
files.

Linking authorizes inspection; it does not authorize applying migrations. The
deployment gate in `docs/advanced-statistics-roadmap.md` still requires hosted
schema and Row Level Security review, backup verification, local rehearsal,
rollback review, and explicit approval.

Never run `supabase db reset --linked`. It resets the linked hosted database.
