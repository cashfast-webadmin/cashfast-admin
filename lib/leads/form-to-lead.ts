/**
 * Form/API payload for leads: same field names as public.leads (snake_case).
 * Use these names in forms so payloads match the table and need no manual mapping.
 *
 * Only transformations: parse string numbers, normalize work_profile value,
 * and optional annual_sales_range -> annual_sales when present in lead_source_details.
 */

import type { Database, Json } from "@/lib/types/supabase"

export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"]

/** DB enum values for work_profile */
export type WorkProfile = "salaried" | "self_employed"

/**
 * Form payload shape: same keys as public.leads (snake_case).
 * Numeric fields accept string | number so forms can submit strings.
 * Omit organization_id; caller provides it when preparing the insert.
 */
export type FormLeadInput = {
  name?: string | null
  email?: string | null
  phone?: string | null
  loan_amount?: string | number | null
  loan_type?: string | null
  work_profile?: WorkProfile | "Salaried" | "Self-Employed" | string | null
  monthly_salary?: string | number | null
  annual_sales?: string | number | null
  source?: string | null
  campaign?: string | null
  medium?: string | null
  referrer?: string | null
  lead_source_details?: Record<string, unknown> | null
  customer_query?: string | null
  /** If UI sends a range label (e.g. "5-10 Lac"), put it here; we derive annual_sales when work_profile is self_employed */
  annual_sales_range?: string | null
}

/** Known annual sales range labels -> midpoint in lac (converted to rupees in prepare) */
const ANNUAL_SALES_RANGE_MID_LAC: Record<string, number> = {
  "5-10 Lac": 7.5,
  "10-15 Lac": 12.5,
  "15-20 Lac": 17.5,
  "20-25 Lac": 22.5,
  "25-30 Lac": 27.5,
  "30-35 Lac": 32.5,
  "35-40 Lac": 37.5,
  "40-45 Lac": 42.5,
  "45-50 Lac": 47.5,
  "50-75 Lac": 62.5,
  "75-100 Lac (1 CR)": 87.5,
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const num = Number(String(value).replace(/,/g, "").trim())
  return Number.isFinite(num) ? num : null
}

function normalizeWorkProfile(
  v: FormLeadInput["work_profile"]
): WorkProfile {
  if (!v) return "salaried"
  const s = String(v).toLowerCase().replace(/-/g, "_")
  return s === "self_employed" ? "self_employed" : "salaried"
}

/**
 * Prepares a form payload (already using table field names) into a LeadInsert.
 * Caller must pass organization_id. Only does parsing and normalization.
 */
export function prepareLeadInsert(
  input: FormLeadInput,
  organizationId: string
): LeadInsert {
  const email = input.email != null ? String(input.email).trim() || null : null
  const phone = input.phone != null ? String(input.phone).trim() || null : null
  if (!email && !phone) {
    throw new Error("At least one of email or phone is required")
  }

  const work_profile = normalizeWorkProfile(input.work_profile)
  const loan_amount = parseNumber(input.loan_amount)
  const monthly_salary =
    work_profile === "salaried" ? parseNumber(input.monthly_salary) ?? null : null
  let annual_sales = parseNumber(input.annual_sales)
  const details: Record<string, Json> =
    input.lead_source_details && typeof input.lead_source_details === "object"
      ? { ...(input.lead_source_details as Record<string, Json>) }
      : {}

  if (work_profile === "self_employed") {
    const range =
      input.annual_sales_range?.trim() ?? (details["annual_sales_range"] as string)?.trim()
    if (range && annual_sales == null) {
      const lac = ANNUAL_SALES_RANGE_MID_LAC[range]
      annual_sales = lac != null ? lac * 100_000 : null
      details["annual_sales_range"] = range
    }
  }

  return {
    organization_id: organizationId,
    name: (input.name != null ? String(input.name).trim() : "") || "—",
    email: email ?? null,
    phone: phone ?? null,
    loan_amount: loan_amount ?? null,
    loan_type: input.loan_type?.trim() ?? null,
    work_profile,
    monthly_salary,
    annual_sales,
    source: input.source?.trim() ?? "website",
    campaign: input.campaign?.trim() ?? null,
    medium: input.medium?.trim() ?? null,
    referrer: input.referrer?.trim() ?? null,
    lead_source_details: details,
    customer_query: input.customer_query?.trim() ?? null,
  }
}

/** @deprecated Use prepareLeadInsert with FormLeadInput (same keys as DB) */
export const formPayloadToLeadInsert = prepareLeadInsert
