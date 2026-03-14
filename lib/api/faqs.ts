"use client"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/types/supabase"

export type FaqRow = Database["public"]["Tables"]["faqs"]["Row"]
export type FaqInsert = Database["public"]["Tables"]["faqs"]["Insert"]
export type FaqUpdate = Database["public"]["Tables"]["faqs"]["Update"]

export const faqsQueryKeys = {
  list: () => ["faqs", "list"] as const,
  detail: (id: string) => ["faqs", id] as const,
}

async function getFaqs(): Promise<FaqRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) throw error
  return (data ?? []) as FaqRow[]
}

async function getFaqById(id: string): Promise<FaqRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as FaqRow
}

async function createFaq(payload: FaqInsert): Promise<FaqRow> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("faqs")
    // @ts-expect-error -- Supabase generated types can infer insert payload as never for multi-schema Database
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as FaqRow
}

async function updateFaq(id: string, payload: FaqUpdate): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from("faqs")
    // @ts-expect-error -- Supabase generated types can infer update payload as never for multi-schema Database
    .update(payload)
    .eq("id", id)
  if (error) throw error
}

async function deleteFaq(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("faqs").delete().eq("id", id)
  if (error) throw error
}

export const faqsApi = {
  getFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
}
