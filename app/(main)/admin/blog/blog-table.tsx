"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { DataTable } from "@/components/data-table/data-table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { blogsApi, blogsQueryKeys, type BlogRow } from "@/lib/api/blogs"
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
import { BlogFormDrawer } from "./blog-form-drawer"
import { getBlogColumns } from "./blog-columns"

function filterBlogsBySearch(blogs: BlogRow[], search: string): BlogRow[] {
  const term = search.trim().toLowerCase()
  if (!term) return blogs
  return blogs.filter(
    (blog) =>
      blog.title.toLowerCase().includes(term) ||
      blog.slug.toLowerCase().includes(term) ||
      (blog.excerpt || "").toLowerCase().includes(term)
  )
}

export function BlogTable() {
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editBlog, setEditBlog] = useState<BlogRow | null>(null)
  const [deleteBlog, setDeleteBlog] = useState<BlogRow | null>(null)
  const [pendingPublishId, setPendingPublishId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const {
    data: result,
    isLoading,
    error,
  } = useQuery({
    queryKey: blogsQueryKeys.list({
      sortBy: "updated_at",
      sortOrder: "desc",
      page: 0,
      pageSize: 200,
    }),
    queryFn: () =>
      blogsApi.getBlogs({
        sortBy: "updated_at",
        sortOrder: "desc",
        page: 0,
        pageSize: 200,
      }),
  })

  const blogs = result?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blogsApi.deleteBlog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs", "list"] })
      toast.success("Blog post deleted")
      setDeleteBlog(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete post")
    },
  })

  const publishMutation = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      setPendingPublishId(id)
      if (publish) {
        await blogsApi.publishBlog(id)
      } else {
        await blogsApi.unpublishBlog(id)
      }
    },
    onSuccess: (_value, variables) => {
      queryClient.invalidateQueries({ queryKey: ["blogs", "list"] })
      toast.success(
        variables.publish ? "Blog post published" : "Blog post moved to draft"
      )
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update publish state"
      )
    },
    onSettled: () => setPendingPublishId(null),
  })

  const openAdd = useCallback(() => {
    setEditBlog(null)
    setDrawerOpen(true)
  }, [])
  const openEdit = useCallback((blog: BlogRow) => {
    setEditBlog(blog)
    setDrawerOpen(true)
  }, [])

  const filteredBlogs = useMemo(
    () => filterBlogsBySearch(blogs, searchQuery),
    [blogs, searchQuery]
  )

  const columns = useMemo(
    () =>
      getBlogColumns({
        pendingPublishId,
        onEdit: openEdit,
        onDelete: setDeleteBlog,
        onPublish: (blog) =>
          publishMutation.mutate({ id: blog.id, publish: true }),
        onUnpublish: (blog) =>
          publishMutation.mutate({ id: blog.id, publish: false }),
      }),
    [openEdit, pendingPublishId, publishMutation]
  )

  const table = useDataTableInstance({
    data: filteredBlogs,
    columns,
    getRowId: (row) => row.id,
    enableRowSelection: false,
  })

  const emptyBody =
    isLoading && blogs.length === 0 ? (
      <TableRow>
        <TableCell colSpan={columns.length} className="h-24 text-center">
          <span className="text-sm text-muted-foreground">
            Loading blog posts…
          </span>
        </TableCell>
      </TableRow>
    ) : !isLoading && blogs.length === 0 ? (
      <TableRow>
        <TableCell colSpan={columns.length} className="p-0">
          <div className="flex items-center justify-center p-8">
            <Empty className="bg-muted">
              <EmptyHeader>
                <EmptyTitle>No blog posts yet</EmptyTitle>
                <EmptyDescription>
                  Draft, publish, and manage your org-scoped blog content here.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openAdd}>Create first post</Button>
              </EmptyContent>
            </Empty>
          </div>
        </TableCell>
      </TableRow>
    ) : !isLoading && filteredBlogs.length === 0 && searchQuery.trim() ? (
      <TableRow>
        <TableCell colSpan={columns.length} className="h-24 text-center">
          <span className="text-sm text-muted-foreground">
            No blog posts match your search.
          </span>
        </TableCell>
      </TableRow>
    ) : undefined

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-0">
      <div className="flex shrink-0 flex-col border-b bg-background px-4 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Blog</h2>
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
              aria-label={
                searchQuery.trim()
                  ? `${filteredBlogs.length} of ${blogs.length} posts`
                  : `${blogs.length} posts`
              }
            >
              {searchQuery.trim()
                ? `${filteredBlogs.length}/${blogs.length}`
                : blogs.length}
            </span>
          </div>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search title, slug, or excerpt…"
            focusShortcut="mod+k"
            focusShortcutLabel="⌘K"
          />
          <div className="flex flex-1 items-center gap-2.5" />
          <Button onClick={openAdd} size="lg">
            <Plus className="size-4" />
            Add Blog Post
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="mx-4 mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">
              Failed to load blog posts. {(error as Error).message}
            </p>
          </div>
        ) : null}
        <DataTable
          table={table}
          columns={columns}
          stickyHeader
          compact
          emptyBody={emptyBody}
        />
      </div>

      <BlogFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editBlog={editBlog}
      />

      <AlertDialog
        open={!!deleteBlog}
        onOpenChange={(open) => !open && setDeleteBlog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete blog post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBlog && deleteMutation.mutate(deleteBlog.id)}
              variant="destructive"
              size="lg"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
