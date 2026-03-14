"use client"

import { BadgeCheck, Bell, CreditCard, LogOut } from "lucide-react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authApi, authQueryKeys } from "@/lib/api/auth"
import { getInitials } from "@/lib/utils"

export function AccountSwitcher() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: account } = useQuery({
    queryKey: authQueryKeys.accountDetails,
    queryFn: authApi.getAccountDetails,
  })
  const signOutMutation = useMutation({
    mutationFn: authApi.signOut,
  })

  const displayName = account?.displayName ?? account?.email ?? "User"
  const email = account?.email ?? ""
  const avatarUrl = account?.avatarUrl ?? undefined

  async function handleLogout() {
    await signOutMutation.mutateAsync()
    queryClient.setQueryData(authQueryKeys.accountDetails, null)
    await queryClient.invalidateQueries({ queryKey: authQueryKeys.accountDetails })
    router.push("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-9 rounded-lg">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="rounded-lg">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg p-0"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <div className="border-b px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-10 rounded-lg">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="rounded-lg">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        </div>
        <div className="space-y-1 p-1">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/account">
              <BadgeCheck />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
