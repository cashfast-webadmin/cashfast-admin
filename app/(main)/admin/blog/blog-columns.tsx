"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BlogRow } from "@/lib/api/blogs"
import { BlogPublishActions } from "./blog-publish-actions"

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function getStatusBadgeClass(status: BlogRow["status"]): string {
  if (status === "published") return "bg-green-500 text-white"
  if (status === "archived") return "bg-muted-foreground text-white"
  return "bg-yellow-500 text-black"
}

export function getBlogColumns({
  pendingPublishId,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
}: {
  pendingPublishId?: string | null
  onEdit: (blog: BlogRow) => void
  onDelete: (blog: BlogRow) => void
  onPublish: (blog: BlogRow) => void
  onUnpublish: (blog: BlogRow) => void
}): ColumnDef<BlogRow>[] {
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
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Title"
          className="text-xs"
        />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{row.original.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            /blog/{row.original.slug}
          </p>
        </div>
      ),
      enableSorting: true,
      minSize: 220,
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
        <Badge
          variant="secondary"
          className={`text-[11px] capitalize ${getStatusBadgeClass(
            row.original.status
          )}`}
        >
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
      enableSorting: true,
      size: 110,
    },
    {
      accessorKey: "published_at",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Published"
          className="text-xs"
        />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.original.published_at)}
        </span>
      ),
      enableSorting: true,
      minSize: 160,
    },
    {
      accessorKey: "updated_at",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Updated"
          className="text-xs"
        />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.original.updated_at)}
        </span>
      ),
      enableSorting: true,
      minSize: 160,
    },
    {
      id: "publish",
      header: () => <span className="text-xs text-muted-foreground">Publish</span>,
      cell: ({ row }) => (
        <BlogPublishActions
          blog={row.original}
          isPending={pendingPublishId === row.original.id}
          onPublish={onPublish}
          onUnpublish={onUnpublish}
        />
      ),
      enableSorting: false,
      size: 120,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const blog = row.original
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
              <DropdownMenuItem onClick={() => onEdit(blog)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(blog)}
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
      size: 56,
    },
  ]
}
