"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronRight, EllipsisVertical } from "lucide-react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  leadPriorityOptions,
  leadStatusOptions,
  leadsApi,
  leadsQueryKeys,
  type LeadPriority,
  type LeadRow,
  type LeadStatus,
} from "@/lib/api/leads"

export type { LeadRow } from "@/lib/api/leads"

function LeadStatusSelect({
  leadId,
  status,
}: {
  leadId: string
  status: LeadStatus
}) {
  const queryClient = useQueryClient()

  async function handleChange(value: LeadStatus) {
    await leadsApi.updateLeadStatus(leadId, value)
    await queryClient.invalidateQueries({ queryKey: leadsQueryKeys.list })
  }

  const currentOption = leadStatusOptions.find((s) => s.value === status)

  return (
    <Select value={status} onValueChange={handleChange}>
      <SelectTrigger
        className={cn(
          "h-auto min-h-0 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none [&>svg]:hidden",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        {currentOption ? (
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1 px-1.5 py-0 text-xs font-normal"
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                currentOption.color
              )}
            />
            <span>{currentOption.label}</span>
          </Badge>
        ) : (
          <Badge variant="secondary" className="cursor-pointer text-xs">
            <SelectValue placeholder="Status" />
          </Badge>
        )}
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {leadStatusOptions.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <span className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", s.color)} />
                <span>{s.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function LeadPrioritySelect({
  leadId,
  priority,
}: {
  leadId: string
  priority: string
}) {
  const queryClient = useQueryClient()
  const value = priority as LeadPriority

  async function handleChange(newValue: LeadPriority) {
    await leadsApi.updateLeadPriority(leadId, newValue)
    await queryClient.invalidateQueries({ queryKey: leadsQueryKeys.list })
  }

  const currentOption = leadPriorityOptions.find((p) => p.value === value)

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger
        className={cn(
          "h-auto min-h-0 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none [&>svg]:hidden",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        {currentOption ? (
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1 px-1.5 py-0 text-xs font-normal"
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                currentOption.color
              )}
            />
            <span>{currentOption.label}</span>
          </Badge>
        ) : (
          <Badge variant="secondary" className="cursor-pointer text-xs">
            <SelectValue placeholder="Priority" />
          </Badge>
        )}
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          {leadPriorityOptions.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              <span className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", p.color)} />
                <span>{p.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function formatLeadDate(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatLeadCurrency(value: number | null) {
  if (value == null) return ""
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

export const leadsColumns: ColumnDef<LeadRow>[] = [
  {
    id: "expand",
    header: () => null,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => row.toggleExpanded()}
        aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </Button>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 36,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 36,
  },

  {
    id: "contact",
    accessorFn: (row) => [row.email, row.phone].filter(Boolean).join(" ") || "",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Contact"
        className="text-xs"
      />
    ),
    cell: ({ row }) => {
      const { email, phone } = row.original
      const hasEmail = email != null && email !== ""
      const hasPhone = phone != null && phone !== ""
      if (!hasEmail && !hasPhone)
        return <span className="text-xs text-muted-foreground">—</span>
      return (
        <div className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
          {hasEmail && <span className="break-all">{email}</span>}
          {hasPhone && <span className="tabular-nums">{phone}</span>}
        </div>
      )
    },
    minSize: 120,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" className="text-xs" />
    ),
    cell: ({ row }) => (
      <span className="text-xs font-medium">{row.original.name || ""}</span>
    ),
    enableHiding: false,
    size: 120,
  },
  {
    accessorKey: "loan_type",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Loan type"
        className="text-xs"
      />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.loan_type ?? ""}
      </span>
    ),
    size: 100,
  },
  {
    accessorKey: "loan_amount",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Loan amount"
        className="text-xs"
      />
    ),
    cell: ({ row }) => (
      <span className="text-xs tabular-nums">
        {formatLeadCurrency(row.original.loan_amount)}
      </span>
    ),
    enableSorting: true,
    size: 100,
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Priority"
        className="text-xs"
      />
    ),
    cell: ({ row }) => (
      <LeadPrioritySelect
        leadId={row.original.id}
        priority={row.original.priority}
      />
    ),
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
    size: 120,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Status"
        className="text-xs"
      />
    ),
    cell: ({ row }) => (
      <LeadStatusSelect leadId={row.original.id} status={row.original.status} />
    ),
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
    size: 120,
  },
  {
    accessorKey: "assigned_to",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Assigned to"
        className="text-xs"
      />
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {row.original.assigned_to}
      </Badge>
    ),
    size: 100,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Created"
        className="text-xs"
      />
    ),
    cell: ({ row }) => (
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {formatLeadDate(row.original.created_at)}
      </span>
    ),
    enableSorting: true,
    size: 100,
  },
  {
    id: "actions",
    cell: () => (
      <Button
        variant="ghost"
        className="flex size-7 text-muted-foreground"
        size="icon"
      >
        <EllipsisVertical className="size-4" />
        <span className="sr-only">Open menu</span>
      </Button>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  },
]
