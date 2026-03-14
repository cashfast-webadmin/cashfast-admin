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

/**
 * Query keys used by React Query for leads.
 */
export const leadsQueryKeys = {
  list: ["leads"] as const,
  detail: (id: string) => ["leads", id] as const,
}

/**
 * Fetch all leads for the current org (RLS applies). Excludes soft-deleted.
 */
async function getLeads(): Promise<LeadRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as LeadRow[]
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
  updateLead,
  deleteLead,
}
