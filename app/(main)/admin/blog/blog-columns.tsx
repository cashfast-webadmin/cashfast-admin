"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Edit2, EllipsisVertical, Link2, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { blogsApi, type BlogRow, type BlogStatus } from "@/lib/api/blogs"

const BLOG_STATUS_OPTIONS: {
  label: string
  value: BlogStatus
  color: string
}[] = [
  { label: "Draft", value: "draft", color: "bg-slate-500" },
  { label: "Published", value: "published", color: "bg-green-500" },
  { label: "Archived", value: "archived", color: "bg-muted-foreground" },
]

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function BlogStatusSelect({
  blogId,
  status,
  publishedAt,
}: {
  blogId: string
  status: BlogStatus
  publishedAt: string | null
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<BlogStatus | null>(null)

  async function applyStatusChange(value: BlogStatus) {
    await blogsApi.updateBlog(blogId, {
      status: value,
      published_at: value === "published" ? new Date().toISOString() : null,
    })
    await queryClient.invalidateQueries({ queryKey: ["blogs", "list"] })
  }

  function handleSelect(newValue: BlogStatus) {
    if (newValue === status) return
    setPendingStatus(newValue)
    setConfirmOpen(true)
  }

  function handleConfirm() {
    if (pendingStatus == null) return
    applyStatusChange(pendingStatus)
    setConfirmOpen(false)
    setPendingStatus(null)
  }

  function handleCancel() {
    setConfirmOpen(false)
    setPendingStatus(null)
  }

  const currentOption = BLOG_STATUS_OPTIONS.find((s) => s.value === status)
  const pendingOption =
    pendingStatus != null
      ? BLOG_STATUS_OPTIONS.find((s) => s.value === pendingStatus)
      : null

  return (
    <>
      <Select value={status} onValueChange={handleSelect}>
        <SelectTrigger
          className={cn(
            "h-auto min-h-0 w-auto min-w-0 border-0 bg-transparent p-0 shadow-none [&>svg]:hidden",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50"
          )}
        >
          {currentOption ? (
            <span className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  currentOption.color
                )}
              />
              <span>{currentOption.label}</span>
            </span>
          ) : (
            <SelectValue placeholder="Status" className="text-xs" />
          )}
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {BLOG_STATUS_OPTIONS.map((s) => (
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

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) setPendingStatus(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change status?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingOption
                ? `Change this post's status to "${pendingOption.label}"?`
                : "Change status?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function getBlogColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (blog: BlogRow) => void
  onDelete: (blog: BlogRow) => void
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
        <span className="ps-2 text-xs text-muted-foreground tabular-nums">
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
        <Button
          variant="ghost"
          className="group h-auto min-h-0 w-full justify-start gap-1.5 p-0 text-left font-medium hover:bg-transparent hover:text-primary hover:underline hover:underline-offset-2"
          onClick={() => onEdit(row.original)}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{row.original.title}</p>
          </div>
          <Edit2
            className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70"
            aria-hidden
          />
        </Button>
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
        <BlogStatusSelect
          blogId={row.original.id}
          status={row.original.status}
          publishedAt={row.original.published_at}
        />
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
                onClick={() => onDelete(blog)}
                variant="destructive"
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
