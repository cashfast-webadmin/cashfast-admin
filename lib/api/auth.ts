"use client"

import { decodeAccessTokenPayload } from "@/lib/auth/jwt-claims"
import type { AuthUser, SignInCredentials } from "@/lib/auth/types"
import { createClient } from "@/lib/supabase/client"

/**
 * Query keys used by React Query for auth-related data.
 */
export const authQueryKeys = {
  user: ["auth", "user"] as const,
}

/**
 * Provider-agnostic auth API methods for client components.
 */
async function signIn(credentials: SignInCredentials): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })
  if (error) {
    throw error
  }
}

async function signOut(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

async function getUser(): Promise<AuthUser | null> {
  const supabase = createClient()
  const {
    error,
    data: { user },
  } = await supabase.auth.getUser()
  if (error) {
    throw error
  }
  if (!user) return null

  // Prefer app_metadata from the JWT (set by custom access token hook).
  // The API user object may not include hook claims; decoding the token is reliable.
  const { data: session } = await supabase.auth.getSession()
  const payload = decodeAccessTokenPayload(session?.session?.access_token)
  const appMeta = payload?.app_metadata ?? (user.app_metadata as {
    roles?: string[]
    permissions?: string[]
    organization_id?: string
  } | undefined)

  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName:
      user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
    roles: appMeta?.roles?.length ? appMeta.roles : undefined,
    permissions: appMeta?.permissions?.length ? appMeta.permissions : undefined,
    organizationId: appMeta?.organization_id ?? undefined,
  }
}

export const authApi = {
  getUser,
  signIn,
  signOut,
}
