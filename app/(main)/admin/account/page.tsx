"use client"

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useRef } from "react"
import { Calendar, Clock, Shield, Mail } from "lucide-react"

import {
  AvatarUpload,
  type AvatarUploadHandle,
} from "@/app/(main)/admin/account/avatar-upload"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { authApi, authQueryKeys } from "@/lib/api/auth"
import { toast } from "sonner"
import { profilesApi } from "@/lib/api/profiles"
import { createClient } from "@/lib/supabase/client"

const AVATAR_BUCKET = "avatars"

function getStoragePathFromPublicUrl(publicUrl: string): string | null {
  const match = publicUrl.match(/\/object\/public\/avatars\/(.+?)(?:\?|$)/)
  return match ? match[1] : null
}

export default function AccountPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const avatarUploadRef = useRef<AvatarUploadHandle>(null)

  const {
    data: account,
    isLoading,
    error,
  } = useQuery({
    queryKey: authQueryKeys.accountDetails,
    queryFn: authApi.getAccountDetails,
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!account?.id) throw new Error("Not signed in")
      const supabase = createClient()
      const ext = file.name.split(".").pop()?.toLowerCase() || "png"
      const path = `${account.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      await profilesApi.updateProfileAvatar(account.id, publicUrl)
      return publicUrl
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.accountDetails })
      avatarUploadRef.current?.clearFiles()
    },
    onError: (err) => {
      toast.error("Failed to upload photo", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      })
    },
  })

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!account?.id || !account?.avatarUrl) return
      const supabase = createClient()
      const path = getStoragePathFromPublicUrl(account.avatarUrl)
      if (path) {
        await supabase.storage.from(AVATAR_BUCKET).remove([path])
      }
      await profilesApi.updateProfileAvatar(account.id, null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authQueryKeys.accountDetails })
    },
    onError: (err) => {
      toast.error("Failed to remove photo", {
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      })
    },
  })

  if (!isLoading && !account && !error) {
    router.replace("/login")
    return null
  }

  const displayName = account?.displayName ?? account?.email ?? "User"
  const primaryRole = account?.roles?.[0] ?? "Member"

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Profile Summary */}
        <aside className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center pt-6">
              <AvatarUpload
                ref={avatarUploadRef}
                defaultAvatar={account?.avatarUrl ?? undefined}
                onSave={(file) => uploadMutation.mutate(file)}
                onRemoveExisting={() => removeAvatarMutation.mutate()}
                isSaving={uploadMutation.isPending}
                isRemoving={removeAvatarMutation.isPending}
              />

              <div className="mt-4 text-center">
                <h2 className="text-xl font-bold tracking-tight">
                  {displayName}
                </h2>
                <div className="mt-1 flex items-center justify-center gap-1 text-muted-foreground">
                  <Mail className="size-3" />
                  <span className="text-xs font-medium">{account?.email}</span>
                </div>
              </div>

              <Badge variant="secondary" className="mt-4">
                {primaryRole}
              </Badge>

              <div className="mt-8 w-full space-y-4 border-t pt-6">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium tracking-wider text-muted-foreground uppercase">
                    Member Since
                  </span>
                  <span className="font-semibold text-foreground/80">
                    {formatDate(account?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium tracking-wider text-muted-foreground uppercase">
                    Status
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium tracking-wider text-muted-foreground uppercase">
                    Active Roles
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                    <span className="flex flex-col">
                      {account?.roles?.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {account.roles.join(", ")}
                        </p>
                      ) : null}
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

// Helper formatting (keep these as provided or update with date-fns)
function formatDate(iso?: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
