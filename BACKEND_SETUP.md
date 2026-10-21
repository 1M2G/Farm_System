# Backend setup: Netlify Functions and Supabase

This repository contains the backend foundation and email authentication flow. The supplied Supabase project URL and Netlify site origin are prefilled in the ignored local `.env`; the public anon key and database migration still need to be configured before authentication and farm APIs can work.

## 1. Set up the Supabase project

1. In **SQL Editor**, open and run [`supabase/migrations/202610210001_initial_farm_backend.sql`](./supabase/migrations/202610210001_initial_farm_backend.sql).
2. In **Project Settings → API**, copy the public `anon`/publishable key. Do not use or share the `service_role` key; this starter backend does not need it.
3. In **Authentication → Providers**, enable Email, allow new sign-ups, and leave email confirmation enabled. Open email registration was selected, so anyone with a valid email can create an account and their own farm. Sign-up, sign-in, and sign-out are available in **Settings → Account & farm access**.
4. In **Authentication → URL Configuration**, set the Site URL to `https://farmlogic.netlify.app` and add these redirect URLs: `https://farmlogic.netlify.app/**`, `http://localhost:8443/**`, and `http://localhost:8888/**`.

The migration creates user profiles, farms, and role-based farm memberships. Row-level security is enabled. A signed-in user can only read farms they belong to; farm creation assigns the creating user the owner role. Invite/member-management flows are intentionally not enabled yet.

## 2. Configure the local development environment

1. The ignored `.env` file already contains the supplied project URL and allowed local/production origins.
2. Set the same public anon key in both `SUPABASE_ANON_KEY` and `VITE_SUPABASE_ANON_KEY` in `.env`:

   ```dotenv
   SUPABASE_URL=https://kxsxgvyfdqskvximgtkf.supabase.co
   SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ALLOWED_ORIGINS=http://localhost:8443,http://localhost:8888,https://farmlogic.netlify.app
   VITE_SUPABASE_URL=https://kxsxgvyfdqskvximgtkf.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
   ```

   The anon/publishable key is designed for browser use and is constrained by database row-level security. Never put a service-role key or other secret in a `VITE_*` variable.
3. Keep `.env` private; Git ignores it. Restart the development server after changing these values.
4. Start the app and functions together:

   ```powershell
   corepack pnpm install --frozen-lockfile
   corepack pnpm dev:backend
   ```

   Open `http://localhost:8443`, go to **Settings → API and database**, and click **Test backend connection**. A successful check confirms the Netlify function can call the Supabase health RPC. A missing configuration or failed database check is shown as not configured/degraded, not “connected.”

Without a Supabase project, the health endpoint should return `503` with `status: "not_configured"`. That is expected and safe; no credentials or database records are changed.

## 3. Configure Netlify

1. Import this repository into Netlify and set the build command to `pnpm build` and publish directory to `dist` (also recorded in `netlify.toml`).
2. In **Site configuration → Environment variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ALLOWED_ORIGINS` — the exact production site origin, such as `https://your-site.netlify.app` (add any custom domain as a separate comma-separated origin).
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` — the public anon/publishable key; never use the service-role key.
3. Redeploy after saving variables.
4. Test `https://your-site.netlify.app/api/health` and the Settings health check. The database status is connected only when the migration exists and the Supabase RPC succeeds.

Never use a wildcard origin for authenticated APIs. Netlify's secret/environment-variable settings are the place for private credentials. The browser anon key is intended to be public and is still constrained by database row-level security.

## 4. API routes in this starter

- `GET /api/health` — checks backend configuration and the Supabase database RPC.
- `GET /api/farms` — requires `Authorization: Bearer <Supabase access token>` and returns farms allowed by row-level security.
- `POST /api/farms` — requires a signed-in user and JSON such as `{"name":"Green Valley Farm"}`; creates a farm and owner membership.
- `POST /api/payments/initiate` — explicitly returns unavailable; no transaction is initiated until an approved, authenticated payment-provider implementation is added.

**Settings → Account & farm access** supports email sign-up with verification, sign-in, sign-out, and authenticated farm listing/creation. The browser sends the Supabase access token to the Netlify farm function, which verifies the user and executes RLS-constrained queries.

## 5. Still out of scope

OpenAI, Google Maps APIs, Twilio SMS/OTP, MTN MoMo, Airtel Money, payment webhooks, device gateway connections, background jobs, and production monitoring still need separate implementation and provider sandbox credentials. Do not enter those secrets until their server-side integrations are built. The Supabase migration and account flows have not yet been verified against the supplied project.
