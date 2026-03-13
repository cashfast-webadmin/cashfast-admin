"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import type { AuthError, SignInCredentials } from "@/lib/auth/types"
import { getUser, signIn, signOut } from "@/lib/auth/client"
import type { AuthUser } from "@/lib/auth/types"

/**
 * Hook for sign-in. Call signIn() with credentials; handles redirect and refresh.
 * Use in login form.
 */
export function useSignIn(options?: {
  onSuccess?: () => void
  redirectTo?: string
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)

  const doSignIn = useCallback(
    async (credentials: SignInCredentials) => {
      setIsPending(true)
      setError(null)
      const result = await signIn(credentials)
      setIsPending(false)
      if (result.error) {
        setError(result.error)
        return result
      }
      router.push(options?.redirectTo ?? "/dashboard/home")
      router.refresh()
      options?.onSuccess?.()
      return result
    },
    [router, options]
  )

  return { signIn: doSignIn, isPending, error }
}

/**
 * Hook for sign-out. Call signOut(); handles redirect and refresh.
 * Use in header/account menu.
 */
export function useSignOut(options?: {
  onSuccess?: () => void
  redirectTo?: string
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const doSignOut = useCallback(async () => {
    setIsPending(true)
    await signOut()
    setIsPending(false)
    router.push(options?.redirectTo ?? "/login")
    router.refresh()
    options?.onSuccess?.()
  }, [router, options])

  return { signOut: doSignOut, isPending }
}

/**
 * Hook for current user (client-side). Use when you need to show user info or guard UI.
 * Fetches user on mount; use refetch() to re-check session.
 */
export function useUser(): {
  user: AuthUser | null
  isLoading: boolean
  refetch: () => Promise<void>
} {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    const u = await getUser()
    setUser(u)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { user, isLoading, refetch }
}
