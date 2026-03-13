/**
 * Provider-agnostic auth types. Swap the implementation in lib/auth/* without changing these.
 */

export interface AuthUser {
  id: string
  email: string | undefined
  /** Optional display name from provider */
  displayName?: string | null
  /** From JWT app_metadata (custom access token hook) */
  roles?: string[]
  organizationId?: string | null
}

export interface AuthError {
  message: string
}

export interface SignInCredentials {
  email: string
  password: string
}
