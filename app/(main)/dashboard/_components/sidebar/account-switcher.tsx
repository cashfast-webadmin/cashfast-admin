"use client"

import { BadgeCheck, Bell, CreditCard, LogOut } from "lucide-react"
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
  const { data: user, isLoading } = useQuery({
    queryKey: authQueryKeys.user,
    queryFn: authApi.getUser,
  })
  const signOutMutation = useMutation({
    mutationFn: authApi.signOut,
  })

  if (isLoading || !user) {
    return null
  }

  const displayName = user.displayName ?? user.email ?? "User"

  async function handleLogout() {
    await signOutMutation.mutateAsync()
    queryClient.setQueryData(authQueryKeys.user, null)
    await queryClient.invalidateQueries({ queryKey: authQueryKeys.user })
    router.push("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-9 rounded-lg">
          <AvatarImage src={undefined} alt={displayName} />
          <AvatarFallback className="rounded-lg">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 space-y-1 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <BadgeCheck />
            Account
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
