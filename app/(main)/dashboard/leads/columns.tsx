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
  leadStatusOptions,
  leadsApi,
  leadsQueryKeys,
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
            className="cursor-pointer gap-1.5 px-2 py-0.5"
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
          <Badge variant="secondary" className="cursor-pointer">
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

export function formatLeadDate(iso: string | null) {
  if (!iso) return "—"
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
  if (value == null) return "—"
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
        className="size-8"
        onClick={() => row.toggleExpanded()}
        aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
      >
        {row.getIsExpanded() ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </Button>
    ),
    enableSorting: false,
    enableHiding: false,
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
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    enableHiding: false,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <span className="block max-w-[200px] truncate text-muted-foreground">
        {row.original.email ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.phone ?? "—"}</span>
    ),
  },
  {
    accessorKey: "loan_type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loan type" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.loan_type ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "loan_amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Loan amount" />
    ),
    cell: ({ row }) => formatLeadCurrency(row.original.loan_amount),
    enableSorting: true,
  },
  {
    accessorKey: "work_profile",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Profile" />
    ),
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.work_profile?.replace("_", "-") ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <LeadStatusSelect leadId={row.original.id} status={row.original.status} />
    ),
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
  },
  {
    accessorKey: "source",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => <Badge variant="outline">{row.original.source}</Badge>,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground tabular-nums">
        {formatLeadDate(row.original.created_at)}
      </span>
    ),
    enableSorting: true,
  },
  {
    id: "actions",
    cell: () => (
      <Button
        variant="ghost"
        className="flex size-8 text-muted-foreground"
        size="icon"
      >
        <EllipsisVertical />
        <span className="sr-only">Open menu</span>
      </Button>
    ),
    enableSorting: false,
    enableHiding: false,
  },
]
