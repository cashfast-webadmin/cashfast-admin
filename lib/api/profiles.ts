"use client"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/types/supabase"

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

export const profilesQueryKeys = {
  list: ["profiles", "list"] as const,
  listByRole: (role: string) => ["profiles", "list", role] as const,
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

/** Returns profiles for users that have the given role (e.g. "lead_executive"). Uses RPC so RLS on authz is not exposed. */
async function getProfilesByRole(roleName: string): Promise<ProfileRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_profiles_by_role", {
    role_name: roleName,
  } as never)
  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

export const profilesApi = {
  getProfiles,
  getProfilesByRole,
}
