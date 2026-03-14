"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react"

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
        <span className="text-xs text-muted-foreground tabular-nums ps-2">
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
        <span className="line-clamp-2 text-xs font-medium">
          {row.original.question}
        </span>
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
        <span className="tabular-nums text-xs text-muted-foreground">
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
              <Button
                variant="ghost"
                size="icon"
                className="size-8 data-[state=open]:bg-muted"
                aria-label="Open menu"
              >
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(faq)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
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
