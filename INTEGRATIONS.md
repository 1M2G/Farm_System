# Integration status and setup

## Current implementation status

| Capability | Current status |
| --- | --- |
| Weather | Live Open-Meteo current conditions, 24-hour hourly forecast, and seven-day daily forecast for Kayunga. Refreshes every 15 minutes and can be refreshed manually. Requests time out after 12 seconds and incomplete provider data is rejected. |
| Google Maps | The Fields page embeds a Google map. Maps JavaScript, Places, geocoding, routes, and synchronization with stored locations are not implemented. |
| OpenAI | Not connected. The Farm Helper answers a few questions from local page state and identifies itself as a local helper. It does not call an AI model. |
| SMS and OTP | Not connected. Twilio has been selected as the intended SMS gateway, but sending, OTP, and delivery status endpoints are not implemented. |
| Mobile money | Not connected. MTN MoMo and Airtel Money payment endpoints, webhooks, persistence, and reconciliation are not implemented. The UI reports that the provider is not configured; a missing backend now returns an error instead of a fabricated pending payment. |
| Backend, authentication, and database | Netlify Function routes and a Supabase PostgreSQL migration provide the starter backend. Settings includes verified-email sign-up/sign-in/sign-out and authenticated farm list/create calls. The supplied Supabase project still needs its migration and anon key configured before the live flow can be verified. |

## Provider activation requirements

These providers require server-side integration work or account configuration before their credentials can be used by this application:

- **Supabase:** run the migration in `supabase/migrations/`, enable email Auth with confirmation, and configure the project URL and public anon key. The service-role key is not needed by this starter.
- **Netlify Functions:** deploy the included health, farm, and safe-unavailable payment routes. The farm routes verify Supabase users and rely on row-level security. Configure the server-side and `VITE_*` public Supabase values as described in `BACKEND_SETUP.md`.
- **OpenAI:** activate API access and billing as required. Keep the API key and model configuration in the server environment; do not place the key in `VITE_*` variables.
- **Google Maps Platform:** enable only the required APIs and billing. Restrict a browser key to the deployed site for Maps JavaScript; keep server-side service credentials in Netlify environment variables.
- **Twilio:** configure an account, a sender or Messaging Service, and any destination-country/regulatory requirements. Keep the Account SID, Auth Token, and sender configuration server-side.
- **MTN MoMo and Airtel Money:** obtain the appropriate collection/payment products, sandbox access, credentials, callback configuration, and production approval. Keep all secrets server-side and use provider status checks as the source of payment truth.

Set secrets through the deployment provider's environment-variable/secrets interface. Do not paste production credentials into chat, commit them, or expose them in browser `VITE_*` variables. Configure sandbox and production credentials separately.

## Verification performed

- The Netlify Functions and Supabase schema are scaffolded; local Netlify Functions were run through `corepack pnpm dev:backend`. Settings → API and database reports the expected `not_configured` status until the anon key is configured and the migration is applied.
- Browser checks confirmed `/api/farms` returns `503` while authentication is unconfigured and `/api/payments/initiate` returns `503` without creating a payment.
- Build and type checks cover the new authentication UI and token-bearing farm API client. The supplied Supabase migration, email flow, protected farm route, and RLS policies have not been tested against the live project yet; the key and migration are not available in this workspace.
- A browser test against the running Vite app successfully retrieved real Open-Meteo weather and rendered the live current conditions and tomorrow's forecast.
- The weather advisory displayed the provider-returned forecast rather than the prior hard-coded rain values.
- A browser test submitted the MTN payment form without a configured backend. It displayed “No payment was initiated,” and the wallet remained at three entries. This validates the safe unavailable-provider path only; it is not a payment-provider integration test.
- OpenAI, Google Maps Platform APIs, Twilio, MTN MoMo, Airtel Money, Supabase live authentication/database flows, and webhooks have not passed integration tests. No production readiness is claimed for them.
