"use client"

import type { AuthError, AuthUser, SignInCredentials } from "@/lib/auth/types"
import { createClient } from "@/lib/supabase/client"

/**
 * Sign in with email and password.
 * @returns { error } if sign-in failed
 */
export async function signIn(
  credentials: SignInCredentials
): Promise<{ error?: AuthError }> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })
  if (error) return { error: { message: error.message } }
  return {}
}

/**
 * Sign out the current user and clear session.
 */
export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}

/**
 * Get the currently authenticated user (client-side).
 * Returns null if not signed in or session invalid.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return {
    id: user.id,
    email: user.email ?? undefined,
    displayName: user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
  }
}
