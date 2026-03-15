"use client"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/types/supabase"

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"]
export type LeadStatus = LeadRow["status"]
export type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"]

/** Priority values allowed by DB check constraint. */
export type LeadPriority = "low" | "medium" | "high" | "urgent"

/**
 * Status options for filters, selects, and badges. Reuse in table filters and status column.
 */
export const leadStatusOptions: {
  value: LeadStatus
  label: string
  color: string
}[] = [
  { value: "new", label: "New", color: "bg-slate-500" },
  { value: "contacted", label: "Contacted", color: "bg-violet-500" },
  { value: "qualified", label: "Qualified", color: "bg-blue-500" },
  { value: "proposal_sent", label: "Proposal sent", color: "bg-violet-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-destructive" },
  { value: "on_hold", label: "On hold", color: "bg-yellow-500" },
]

/**
 * Priority options for filters and priority column select.
 */
export const leadPriorityOptions: {
  value: LeadPriority
  label: string
  color: string
}[] = [
  { value: "low", label: "Low", color: "bg-green-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "high", label: "High", color: "bg-violet-500" },
  { value: "urgent", label: "Urgent", color: "bg-orange-500" },
]

/** Params for server-side leads list (filter, search, sort, pagination). */
export type GetLeadsParams = {
  search?: string
  status?: string[]
  priority?: string[]
  sortBy?: string
  sortOrder?: "asc" | "desc"
  page?: number
  pageSize?: number
  /** ISO date string; filter leads created on or after this time. */
  created_at_after?: string
  /** ISO date string; filter leads created on or before this time. */
  created_at_before?: string
}

/** Result of server-side getLeads: one page of rows + total count. */
export type GetLeadsResult = {
  data: LeadRow[]
  total: number
}

/** Sortable column ids allowed by the API. */
const SORTABLE_COLUMNS = ["created_at", "loan_amount", "name"] as const

/**
 * Escape for PostgREST ilike: preserve % and _ for SQL LIKE, escape \ and " for
 * use inside double-quoted value (PostgREST reserves , : ( ) and treats values
 * with special chars better when double-quoted).
 */
function escapeIlikePattern(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '""')
}

/**
 * Query keys used by React Query for leads.
 */
export const leadsQueryKeys = {
  list: (params: GetLeadsParams) => ["leads", "list", params] as const,
  detail: (id: string) => ["leads", id] as const,
}

/**
 * Fetch leads with server-side filter, search, sort, and pagination.
 * RLS applies. Excludes soft-deleted. Returns one page and total count.
 */
async function getLeads(params: GetLeadsParams = {}): Promise<GetLeadsResult> {
  const supabase = createClient()
  const page = params.page ?? 0
  const pageSize = params.pageSize ?? 10
  const sortBy =
    params.sortBy && SORTABLE_COLUMNS.includes(params.sortBy as (typeof SORTABLE_COLUMNS)[number])
      ? params.sortBy
      : "created_at"
  const ascending = params.sortOrder !== "desc"

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .is("deleted_at", null)

  if (params.status?.length) {
    query = query.in("status", params.status)
  }
  if (params.priority?.length) {
    query = query.in("priority", params.priority)
  }
  const search = params.search?.trim()
  if (search) {
    const escaped = escapeIlikePattern(search)
    const pattern = `"%${escaped}%"`
    query = query.or(
      `name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
    )
  }
  if (params.created_at_after) {
    query = query.gte("created_at", params.created_at_after)
  }
  if (params.created_at_before) {
    query = query.lte("created_at", params.created_at_before)
  }

  query = query.order(sortBy, { ascending })
  const from = page * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) throw error
  return {
    data: (data ?? []) as LeadRow[],
    total: count ?? 0,
  }
}

/**
 * Fetch a single lead by id. Returns null if not found or no access.
 */
async function getLeadById(id: string): Promise<LeadRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as LeadRow
}

/**
 * Update a lead's status. RLS and triggers (e.g. status history) apply.
 */
async function updateLeadStatus(
  leadId: string,
  status: LeadStatus
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("leads")
    // @ts-expect-error -- Supabase generated types can infer update payload as never for multi-schema Database
    .update({ status })
    .eq("id", leadId)
  if (error) throw error
}

/**
 * Update a lead's priority.
 */
async function updateLeadPriority(
  leadId: string,
  priority: LeadPriority
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("leads")
    // @ts-expect-error -- Supabase generated types can infer update payload as never for multi-schema Database
    .update({ priority })
    .eq("id", leadId)
  if (error) throw error
}

/**
 * Update a lead's assignee.
 */
async function updateLeadAssignee(
  leadId: string,
  assignedTo: string | null
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("leads")
    // @ts-expect-error -- Supabase generated types can infer update payload as never for multi-schema Database
    .update({ assigned_to: assignedTo })
    .eq("id", leadId)
  if (error) throw error
}

/**
 * Partial update of a lead. Only provided fields are updated.
 */
async function updateLead(leadId: string, payload: LeadUpdate): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("leads")
    // @ts-expect-error -- Supabase generated types can infer update payload as never for multi-schema Database
    .update(payload)
    .eq("id", leadId)
  if (error) throw error
}

/**
 * Soft-delete a lead (sets deleted_at). Never hard-deletes.
 */
async function deleteLead(leadId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("leads")
    // @ts-expect-error -- Supabase generated types can infer update payload as never for multi-schema Database
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", leadId)
  if (error) throw error
}

export const leadsApi = {
  getLeads,
  getLeadById,
  updateLeadStatus,
  updateLeadPriority,
  updateLeadAssignee,
  updateLead,
  deleteLead,
}
