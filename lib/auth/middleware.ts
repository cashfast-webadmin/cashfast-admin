import type { NextRequest, NextResponse } from "next/server"

import type { AuthUser } from "@/lib/auth/types"
import { createServerClientForMiddleware } from "@/lib/supabase/middleware"

export type SessionResult = {
  user: AuthUser | null
  response: NextResponse
}

/**
 * Get the current session from the request (for use in Next.js middleware).
 * Refreshes the session and returns the user plus the response with updated cookies.
 * Swap the implementation when changing auth provider.
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionResult> {
  const { supabase, response } = createServerClientForMiddleware(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const authUser: AuthUser | null = user
    ? {
        id: user.id,
        email: user.email ?? undefined,
        displayName:
          user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
      }
    : null

  return { user: authUser, response }
}
