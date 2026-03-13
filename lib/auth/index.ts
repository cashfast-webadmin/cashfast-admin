/**
 * Auth API and types. Implementations live in client.ts (browser) and middleware.ts (server).
 * Swap those when changing auth provider; types and this surface stay the same.
 */

export { getUser, signIn, signOut } from "./client"
export type { AuthError, AuthUser, SignInCredentials } from "./types"
