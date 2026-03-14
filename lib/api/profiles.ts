"use client"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/types/supabase"

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

export const profilesQueryKeys = {
  list: ["profiles", "list"] as const,
}

async function getProfiles(): Promise<ProfileRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true })

  if (error) throw error
  return data as ProfileRow[]
}

export const profilesApi = {
  getProfiles,
}
