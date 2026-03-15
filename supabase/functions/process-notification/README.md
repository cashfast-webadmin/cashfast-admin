# process-notification

Invoked by **Supabase Database Webhook** when a row is inserted into `notifications_queue`. Sends via Resend (email) and MSG91 (SMS, WhatsApp), then updates the row status.

## Setup

1. **Secrets** (Dashboard → Project Settings → Edge Functions → Secrets):
   - `RESEND_API_KEY` – Resend API key
   - `RESEND_FROM` – From address (e.g. `Cashfast <noreply@yourdomain.com>`)
   - `MSG91_KEY` – MSG91 auth key
   - `MSG91_SMS_FLOW_ID` – (optional) MSG91 flow ID for SMS; if set, uses Flow API with `VAR1` = message
   - `MSG91_SENDER` – (optional) Sender ID for SMS

2. **Database Webhook** (Dashboard → Integrations → Database Webhooks):
   - Table: `notifications_queue`
   - Event: **INSERT**
   - URL: `https://<project-ref>.supabase.co/functions/v1/process-notification`

3. **MSG91 WhatsApp**: Create and approve template `lead_acknowledgement` with variable `name`.

4. **Local**: `supabase functions serve --env-file .env.local`; use `http://host.docker.internal:54321/functions/v1/process-notification` as webhook URL for local DB.
