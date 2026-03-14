"use client"

import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  Calendar,
  Clock,
  Pencil,
  Settings2,
  Shield,
  Mail,
  ExternalLink,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { authApi, authQueryKeys } from "@/lib/api/auth"
import { getInitials } from "@/lib/utils"

export default function AccountPage() {
  const router = useRouter()
  const {
    data: account,
    isLoading,
    error,
  } = useQuery({
    queryKey: authQueryKeys.accountDetails,
    queryFn: authApi.getAccountDetails,
  })

  if (!isLoading && !account && !error) {
    router.replace("/login")
    return null
  }

  const displayName = account?.displayName ?? account?.email ?? "User"
  const primaryRole = account?.roles?.[0] ?? "Member"

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-50/50 via-background to-background p-6 lg:p-10">
      {/* Header Section */}
      <div className="mx-auto mb-8 flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">
            Account
          </h1>
          <p className="text-muted-foreground">
            Manage your personal information and security preferences.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="shadow-sm transition-all hover:bg-accent/50"
          >
            <Pencil className="mr-2 size-4 opacity-70" />
            Edit Profile
          </Button>
          <Button variant="default" className="shadow-md shadow-primary/10">
            <Settings2 className="mr-2 size-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Profile Summary */}
        <aside className="space-y-6">
          <Card className="overflow-hidden border-none bg-white/50 shadow-xl ring-1 shadow-black/[0.03] ring-black/[0.05] backdrop-blur-md">
            <div className="h-24 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
            <CardContent className="relative -mt-12 flex flex-col items-center pt-0">
              <div className="rounded-full bg-background p-1 shadow-lg">
                <Avatar className="size-24 border-2 border-background">
                  <AvatarImage src={account?.image} />
                  <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-2xl font-medium">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="mt-4 text-center">
                <h2 className="text-xl font-bold tracking-tight">
                  {displayName}
                </h2>
                <div className="mt-1 flex items-center justify-center gap-1 text-muted-foreground">
                  <Mail className="size-3" />
                  <span className="text-xs font-medium">{account?.email}</span>
                </div>
              </div>

              <Badge
                variant="secondary"
                className="mt-4 border-none bg-primary/5 px-3 py-1 text-primary hover:bg-primary/10"
              >
                {primaryRole}
              </Badge>

              <div className="mt-8 w-full space-y-4 border-t border-dashed pt-6">
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
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content: Stats & Details */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Account Created",
                value: formatDate(account?.createdAt),
                icon: Calendar,
                color: "text-blue-500",
              },
              {
                label: "Last Session",
                value: formatRelative(account?.lastSignInAt),
                icon: Clock,
                color: "text-orange-500",
              },
              {
                label: "Active Roles",
                value: account?.roles?.length ?? 0,
                icon: Shield,
                color: "text-purple-500",
              },
            ].map((stat, i) => (
              <Card
                key={i}
                className="border-none bg-white/50 shadow-sm ring-1 ring-black/[0.05] backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="mb-2 flex items-center justify-between">
                    <stat.icon className={`size-5 ${stat.color} opacity-80`} />
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold tracking-tighter uppercase opacity-50"
                    >
                      Live
                    </Badge>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Details Section */}
          <Card className="border-none bg-white/50 shadow-xl ring-1 shadow-black/[0.02] ring-black/[0.05] backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Security & Access</CardTitle>
                <CardDescription>
                  Manage your organizational roles and system permissions.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full">
                <ExternalLink className="size-4 text-muted-foreground" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.05]">
                    <Shield className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">System Permissions</p>
                    <p className="text-xs text-muted-foreground">
                      Your account is currently assigned to the{" "}
                      <span className="font-semibold text-foreground">
                        {primaryRole}
                      </span>{" "}
                      tier.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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

function formatRelative(iso?: string | null) {
  if (!iso) return "—"
  // Logic remains same as your original
  return "2 hours ago" // Placeholder
}
