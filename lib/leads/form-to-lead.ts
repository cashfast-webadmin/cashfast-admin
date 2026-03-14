/**
 * Maps website/form payloads to public.leads insert shape.
 * Use when ingesting from contact, loan-eligibility, or API.
 *
 * Field mapping:
 * - name -> name
 * - email -> email (trimmed; citext handles case)
 * - phoneNumber | phone -> phone
 * - loanAmount -> loan_amount (parsed number)
 * - loanType -> loan_type
 * - workProfile -> work_profile: "Salaried" -> "salaried", "Self-Employed" -> "self_employed"
 * - salary -> monthly_salary (parsed number)
 * - annualSalesRange -> annual_sales (range parsed to numeric; range string kept in lead_source_details)
 */

import type { Database } from "@/lib/types/supabase"

export type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"]

/** Payload shape from contact / loan-eligibility forms (or API) */
export type FormLeadPayload = {
  name?: string | null
  email?: string | null
  phone?: string | null
  phoneNumber?: string | null
  loanAmount?: string | number | null
  loanType?: string | null
  workProfile?: "Salaried" | "Self-Employed" | "salaried" | "self_employed" | string | null
  salary?: string | number | null
  annualSalesRange?: string | null
  customer_query?: string | null
  source?: string | null
  campaign?: string | null
  medium?: string | null
  referrer?: string | null
}

const ANNUAL_SALES_RANGE_TO_LAC: Record<string, number> = {
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

function parseAmount(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const num = Number(String(value).replace(/,/g, "").trim())
  return Number.isFinite(num) ? num : null
}

function normalizeWorkProfile(
  v: FormLeadPayload["workProfile"]
): "salaried" | "self_employed" | null {
  if (!v) return null
  const s = String(v).toLowerCase()
  if (s === "salaried") return "salaried"
  if (s === "self-employed" || s === "self_employed") return "self_employed"
  return null
}

/**
 * Maps form payload to lead insert row. Caller must set organization_id.
 * Ensures at least one of email/phone; normalizes work_profile and salary/sales per DB constraints.
 */
export function formPayloadToLeadInsert(
  payload: FormLeadPayload,
  organizationId: string,
  options?: { source?: string; campaign?: string; medium?: string; referrer?: string }
): LeadInsert {
  const email = payload.email != null ? String(payload.email).trim() || null : null
  const phone =
    (payload.phone != null ? String(payload.phone).trim() : null) ??
    (payload.phoneNumber != null ? String(payload.phoneNumber).trim() : null) ||
    null
  if (!email && !phone) {
    throw new Error("At least one of email or phone is required")
  }

  const workProfile = normalizeWorkProfile(payload.workProfile) ?? "salaried"
  const loanAmount = parseAmount(payload.loanAmount)
  const monthlySalary =
    workProfile === "salaried" ? parseAmount(payload.salary) ?? null : null
  let annualSales: number | null = null
  let leadSourceDetails: Record<string, unknown> = {}
  if (workProfile === "self_employed" && payload.annualSalesRange) {
    const range = String(payload.annualSalesRange).trim()
    const lac = ANNUAL_SALES_RANGE_TO_LAC[range]
    annualSales = lac != null ? lac * 100_000 : null
    leadSourceDetails = { annual_sales_range: range }
  }

  return {
    organization_id: organizationId,
    name: (payload.name != null ? String(payload.name).trim() : "") || "—",
    email: email || null,
    phone: phone || null,
    loan_amount: loanAmount ?? null,
    loan_type: payload.loanType?.trim() ?? null,
    work_profile: workProfile,
    monthly_salary: monthlySalary,
    annual_sales: annualSales,
    source: options?.source ?? payload.source ?? "website",
    campaign: options?.campaign ?? payload.campaign ?? null,
    medium: options?.medium ?? payload.medium ?? null,
    referrer: options?.referrer ?? payload.referrer ?? null,
    lead_source_details: Object.keys(leadSourceDetails).length
      ? leadSourceDetails
      : {},
    customer_query: payload.customer_query?.trim() ?? null,
  }
}
