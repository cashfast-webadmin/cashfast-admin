"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Edit2, EllipsisVertical, Link2, Pencil, Trash2 } from "lucide-react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { FaqRow } from "@/lib/api/faqs"

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen).trim() + "…"
}

export function getFaqColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (faq: FaqRow) => void
  onDelete: (faq: FaqRow) => void
}): ColumnDef<FaqRow>[] {
  return [
    {
      id: "index",
      header: () => (
        <span className="ps-2.5 text-xs text-muted-foreground tabular-nums">
          #
        </span>
      ),
      cell: ({ row }) => (
        <span className="ps-2 text-xs text-muted-foreground tabular-nums">
          {row.index + 1}
        </span>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
    {
      accessorKey: "question",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Question"
          className="text-xs"
        />
      ),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          className="group h-auto min-h-0 w-full justify-start gap-1.5 p-0 text-left font-medium hover:bg-transparent hover:text-primary hover:underline hover:underline-offset-2"
          onClick={() => onEdit(row.original)}
        >
          <span className="line-clamp-2 flex-1 text-xs font-medium">
            {row.original.question}
          </span>
          <Edit2
            className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
            aria-hidden
          />
        </Button>
      ),
      enableSorting: true,
      minSize: 180,
    },
    {
      id: "answer",
      accessorFn: (row) => row.answer,
      header: () => (
        <span className="text-xs text-muted-foreground">Answer</span>
      ),
      cell: ({ row }) => (
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {truncate(row.original.answer, 80)}
        </span>
      ),
      enableSorting: false,
      minSize: 200,
    },
    {
      accessorKey: "sort_order",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Order"
          className="text-xs"
        />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {row.original.sort_order}
        </span>
      ),
      enableSorting: true,
      size: 80,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const faq = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(faq)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(faq)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      enableHiding: false,
      size: 48,
    },
  ]
}
