/**
 * Database types for Supabase (authz + public schema).
 * Regenerate with: pnpm supabase:types (requires local Supabase running)
 * or: supabase gen types typescript --project-id <ref> > lib/types/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
      }
      resources: {
        Row: {
          id: string
          organization_id: string | null
          created_by: string | null
          name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          created_by?: string | null
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          created_by?: string | null
          name?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
  authz: {
    Tables: {
      roles: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
        }
        Insert: {
          role_id: string
          permission_id: string
        }
        Update: {
          role_id?: string
          permission_id?: string
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role_id: string
        }
        Insert: {
          user_id: string
          role_id: string
        }
        Update: {
          user_id?: string
          role_id?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      organization_members: {
        Row: {
          user_id: string
          organization_id: string
          role: string
        }
        Insert: {
          user_id: string
          organization_id: string
          role: string
        }
        Update: {
          user_id?: string
          organization_id?: string
          role?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
