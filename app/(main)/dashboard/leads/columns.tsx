"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronRight, EllipsisVertical } from "lucide-react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import type { Database } from "@/lib/types/supabase"

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"]

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

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "secondary",
  contacted: "default",
  qualified: "default",
  proposal_sent: "outline",
  negotiation: "outline",
  won: "default",
  lost: "destructive",
  on_hold: "secondary",
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground truncate max-w-[200px] block">
        {row.original.email ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.phone ?? "—"}</span>
    ),
  },
  {
    accessorKey: "loan_type",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Loan type" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.loan_type ?? "—"}</span>
    ),
  },
  {
    accessorKey: "loan_amount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Loan amount" />,
    cell: ({ row }) => formatLeadCurrency(row.original.loan_amount),
    enableSorting: true,
  },
  {
    accessorKey: "work_profile",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Profile" />,
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.work_profile?.replace("_", "-") ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={statusVariants[row.original.status] ?? "secondary"}>
        {row.original.status.replace("_", " ")}
      </Badge>
    ),
    filterFn: (row, id, value: string[]) =>
      value.length === 0 || value.includes(row.getValue(id)),
  },
  {
    accessorKey: "source",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.source}</Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums whitespace-nowrap">
        {formatLeadDate(row.original.created_at)}
      </span>
    ),
    enableSorting: true,
  },
  {
    id: "actions",
    cell: () => (
      <Button variant="ghost" className="flex size-8 text-muted-foreground" size="icon">
        <EllipsisVertical />
        <span className="sr-only">Open menu</span>
      </Button>
    ),
    enableSorting: false,
    enableHiding: false,
  },
]
