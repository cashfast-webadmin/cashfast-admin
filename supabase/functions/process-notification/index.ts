// Process notification jobs from notifications_queue (invoked by Database Webhook on INSERT).
// Routes by channel: email (Resend), sms/whatsapp (MSG91). Updates status and retry on failure.

/** Ambient declaration for Deno runtime (Edge Function); avoids "Cannot find name 'Deno'" in IDEs without Deno LSP. */
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve: (handler: (req: Request) => Promise<Response>) => void
}

// @ts-expect-error Deno resolves URL imports at runtime; workspace TS has no types for this module
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Cashfast <onboarding@resend.dev>"
const MSG91_KEY = Deno.env.get("MSG91_KEY")
const MSG91_SMS_FLOW_ID = Deno.env.get("MSG91_SMS_FLOW_ID")
const MSG91_SENDER = Deno.env.get("MSG91_SENDER") ?? ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE"
  table: string
  schema: string
  record: NotificationQueueRow | null
  old_record: NotificationQueueRow | null
}

type NotificationQueueRow = {
  id: string
  event_type: string
  channel: string
  recipient_email: string | null
  recipient_phone: string | null
  payload: { name?: string } | null
  status: string
  retry_count: number
  created_at: string
  processed_at: string | null
}

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

async function markSent(id: string) {
  const supabase = supabaseAdmin()
  await supabase
    .from("notifications_queue")
    .update({ status: "sent", processed_at: new Date().toISOString() })
    .eq("id", id)
}

async function markFailed(id: string, retryCount: number) {
  const supabase = supabaseAdmin()
  const status = retryCount >= 3 ? "failed" : "pending"
  await supabase
    .from("notifications_queue")
    .update({
      status,
      retry_count: retryCount,
    })
    .eq("id", id)
}

async function sendEmail(record: NotificationQueueRow): Promise<void> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set")
  const to = record.recipient_email
  if (!to) throw new Error("Missing recipient_email for email channel")
  const name = record.payload?.name ?? ""
  const subject = "Thanks for contacting Cashfast"
  const html = `Hi ${escapeHtml(name)},\n\nThanks for your enquiry.\nOur loan expert will contact you shortly.`

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      html: html.replace(/\n/g, "<br/>"),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${res.status} ${err}`)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function sendSMS(record: NotificationQueueRow): Promise<void> {
  if (!MSG91_KEY) throw new Error("MSG91_KEY not set")
  const mobiles = record.recipient_phone
  if (!mobiles) throw new Error("Missing recipient_phone for sms channel")

  const message = "Thanks for contacting Cashfast. Our loan expert will contact you shortly."
  const mobile = mobiles.replace(/\D/g, "")

  // MSG91 v5 Flow API: flow_id, sender, recipients with mobiles and template variables (e.g. VAR1).
  const body: Record<string, unknown> = MSG91_SMS_FLOW_ID
    ? {
        flow_id: MSG91_SMS_FLOW_ID,
        sender: MSG91_SENDER,
        recipients: [{ mobiles: mobile, VAR1: message }],
      }
    : { mobiles: mobile, message }

  const res = await fetch("https://api.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      authkey: MSG91_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MSG91 SMS error: ${res.status} ${err}`)
  }
}

async function sendWhatsApp(record: NotificationQueueRow): Promise<void> {
  if (!MSG91_KEY) throw new Error("MSG91_KEY not set")
  const to = record.recipient_phone
  if (!to) throw new Error("Missing recipient_phone for whatsapp channel")
  const name = record.payload?.name ?? ""

  const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message", {
    method: "POST",
    headers: {
      authkey: MSG91_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: to.replace(/\D/g, ""),
      type: "template",
      template_name: "lead_acknowledgement",
      body: { name },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MSG91 WhatsApp error: ${res.status} ${err}`)
  }
}

async function processRecord(record: NotificationQueueRow): Promise<void> {
  switch (record.channel) {
    case "email":
      await sendEmail(record)
      break
    case "sms":
      await sendSMS(record)
      break
    case "whatsapp":
      await sendWhatsApp(record)
      break
    default:
      throw new Error(`Unknown channel: ${record.channel}`)
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  let payload: WebhookPayload
  try {
    payload = (await req.json()) as WebhookPayload
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications_queue" || !payload.record) {
    return new Response(
      JSON.stringify({ error: "Expected INSERT on notifications_queue", received: payload }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const record = payload.record as NotificationQueueRow
  const id = record.id
  const retryCount = record.retry_count ?? 0

  try {
    await processRecord(record)
    await markSent(id)
    return new Response(JSON.stringify({ ok: true, id, status: "sent" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[process-notification] failed", { id, channel: record.channel, error: message })
    const nextRetry = retryCount + 1
    await markFailed(id, nextRetry)
    return new Response(
      JSON.stringify({
        ok: false,
        id,
        error: message,
        retry_count: nextRetry,
        status: nextRetry >= 3 ? "failed" : "pending",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
}

Deno.serve(handler)
