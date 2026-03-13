import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/lib/types/supabase"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase anon key")
  }

  return createBrowserClient<Database>(url, key)
}
