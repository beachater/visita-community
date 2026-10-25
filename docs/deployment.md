# Main branch deployment

`.github/workflows/ci-deploy.yml` checks pull requests to `main`. A push to
`main` runs the same checks, applies pending Supabase migrations, builds both
apps, then deploys the `visita-consumer` and `visita-admin` Cloudflare Workers.
Releases are queued so two pushes cannot apply migrations concurrently.

## One-time GitHub configuration

In the GitHub repository, open **Settings → Secrets and variables → Actions**.
Set these repository **secrets**:

| Name | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token scoped to this project; `supabase link` needs Project Settings, API Keys, and API Key Secrets read permissions. |
| `SUPABASE_DB_PASSWORD` | Password for the hosted project's Postgres database. |
| `CLOUDFLARE_API_TOKEN` | Account-scoped token with permission to edit Cloudflare Workers. |
| `CLOUDFLARE_ACCOUNT_ID` | Account that owns both Workers and the R2 bucket. |

Set these repository **variables**:

| Name | Value |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Hosted project reference (the subdomain before `.supabase.co`). It must match both `wrangler.jsonc` files. |
| `SUPABASE_PUBLISHABLE_KEY` | Hosted publishable key. It must match `apps/admin/wrangler.jsonc`. This key is sent to browsers. |

The deployed consumer Worker must already have its `SUPABASE_SECRET_KEY`
Wrangler secret. The `visita-assets-dev` R2 bucket and the Workers AI binding
in the Wrangler configs must also exist. The workflow deploys code and schema;
it does not create those resources, upload R2 scan files, import cafe listings,
or change Supabase Auth settings. Keep secrets out of Git and do not set the
database password as a command-line argument.

If Cloudflare Workers Builds or the Supabase GitHub integration is also set to
auto-deploy `main`, disable that duplicate deploy path so this workflow remains
the single release sequence.

## What runs

1. `pnpm test` and `pnpm typecheck` run on the full workspace.
2. A fresh local Supabase instance applies migrations and runs the RLS smoke test.
3. On `main` only, `supabase db push --dry-run` previews pending migrations,
   then `supabase db push` applies them. Seed data is never pushed.
4. The consumer and admin apps build with the hosted public Supabase values.
   Astro prerenders cafe data during the consumer build, so the hosted schema
   must already include any columns the new code reads.
5. Wrangler deploys the consumer Worker, then the admin Worker.

If any step fails, later steps do not run. A Worker deploy failure after the
database migration still requires a rerun after fixing the cause. The workflow
can be rerun from GitHub Actions, or started with **Run workflow** on `main`.
Supabase skips migrations already recorded in its remote migration history.

For a migration, also commit the regenerated
`packages/shared-types/src/database.types.ts` file as described in the README.

References: [Supabase migration CI](https://supabase.com/docs/guides/deployment/managing-environments),
[Supabase database push](https://supabase.com/docs/guides/deployment/database-migrations),
and [Cloudflare GitHub Actions deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
