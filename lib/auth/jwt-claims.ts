/**
 * Read app_metadata from the Supabase access token (JWT).
 * Custom access token hook writes roles and organization_id into the token;
 * the Auth API user object may not include them, so we decode the JWT.
 */

export interface JwtAppMetadata {
  roles?: string[]
  organization_id?: string
}

/**
 * Decode JWT payload without verifying (token is from our Supabase; we only read claims).
 * Returns null if token is missing or invalid.
 */
export function decodeAccessTokenPayload(accessToken: string | undefined): {
  app_metadata?: JwtAppMetadata
} | null {
  if (!accessToken || typeof accessToken !== "string") return null
  const parts = accessToken.split(".")
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { app_metadata?: JwtAppMetadata }
    return payload
  } catch {
    return null
  }
}
