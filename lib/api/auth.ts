"use client"

import { decodeAccessTokenPayload } from "@/lib/auth/jwt-claims"
import type { AuthUser, SignInCredentials } from "@/lib/auth/types"
import { createClient } from "@/lib/supabase/client"

/**
 * Query keys used by React Query for auth-related data.
 */
export const authQueryKeys = {
  user: ["auth", "user"] as const,
  accountDetails: ["auth", "accountDetails"] as const,
}

/** Extended user info for the Account page (auth user + session details). */
export interface AccountDetails {
  id: string
  email: string | undefined
  displayName?: string | null
  avatarUrl?: string | null
  roles?: string[]
  permissions?: string[]
  organizationId?: string | null
  createdAt: string | null
  lastSignInAt: string | null
  userMetadata: Record<string, unknown>
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
  const appMeta =
    payload?.app_metadata ??
    (user.app_metadata as
      | {
          roles?: string[]
          permissions?: string[]
          organization_id?: string
        }
      | undefined)

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

async function getAccountDetails(): Promise<AccountDetails | null> {
  const base = await getUser()
  if (!base) return null
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .schema("public")
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single()
  return {
    ...base,
    avatarUrl: profile?.avatar_url ?? null,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    userMetadata: (user.user_metadata as Record<string, unknown>) ?? {},
  }
}

export const authApi = {
  getUser,
  getAccountDetails,
  signIn,
  signOut,
}
