# Cloudflare Email Routing integration

The Worker sends the inbound sender address to HexaWave as a CRM reply event. It does not forward message contents, send outbound email, or classify replies with AI.

## Configure and deploy

1. Make the HexaWave backend publicly reachable over HTTPS. Set `HEXAWAVE_API_URL` in `wrangler.toml` to its base URL, without a trailing `/api` (for example, `https://api.example.com`). Do not use `localhost`; Cloudflare must be able to reach the backend.
2. Generate a long random secret and configure it in both places:
   - Backend environment: `CLOUDFLARE_EMAIL_WEBHOOK_SECRET`
   - Cloudflare Worker secret: `HEXAWAVE_EMAIL_WEBHOOK_SECRET`

   Never put the secret in frontend code, commit it, or send it in chat.
3. From this directory, authenticate Wrangler and deploy:

   ```powershell
   npx wrangler login
   npx wrangler secret put HEXAWAVE_EMAIL_WEBHOOK_SECRET
   npx wrangler deploy
   ```

   Wrangler prompts for the secret value without requiring it to be added to a source file. Restart the backend after setting its environment variable.
4. Open the deployed Worker URL in a browser. It checks the backend status endpoint and reports `ready` only when the Worker has its configuration and the backend has its matching secret. A 502 means the backend could not be reached or is unavailable.
5. In the Cloudflare dashboard, open **Email Routing → Email Workers** and add the deployed Worker as a destination. Create or edit an Email Routing rule for the address/domain whose inbound messages should reach HexaWave, and select that Worker as the action. Complete Cloudflare's DNS/MX setup for the domain if Email Routing is not already active.
6. Send a test email from an address that exactly matches an existing CRM lead. Confirm the lead moves to `REPLIED`.

The Worker signs each JSON body with HMAC-SHA256 over `timestamp + "." + raw_body`, sending the Unix timestamp and lowercase hexadecimal signature in `x-hw-timestamp` and `x-hw-signature`. The backend rejects invalid signatures and timestamps outside a five-minute window. Its endpoint is `POST /api/email/cloudflare/inbound`.

Only existing matching leads are updated. Replies to suppressed leads are recorded as ignored and cannot restore the lead to an outreach-eligible state. Deploying the Worker and configuring Cloudflare DNS/routing require access to the user's Cloudflare account; those account-side steps are not performed by this repository change.
