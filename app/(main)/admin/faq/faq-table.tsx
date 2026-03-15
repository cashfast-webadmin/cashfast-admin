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
import { faqsApi, faqsQueryKeys, type FaqRow } from "@/lib/api/faqs"

import { getFaqColumns } from "./faq-columns"
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
import { FaqFormDrawer } from "./faq-form-drawer"

function filterFaqsBySearch(faqs: FaqRow[], search: string): FaqRow[] {
  const term = search.trim().toLowerCase()
  if (!term) return faqs
  return faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(term) ||
      faq.answer.toLowerCase().includes(term)
  )
}

export function FaqTable() {
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editFaq, setEditFaq] = useState<FaqRow | null>(null)
  const [deleteFaq, setDeleteFaq] = useState<FaqRow | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const {
    data: faqs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: faqsQueryKeys.list(),
    queryFn: () => faqsApi.getFaqs(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => faqsApi.deleteFaq(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqsQueryKeys.list() })
      toast.success("FAQ deleted")
      setDeleteFaq(null)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete FAQ")
    },
  })

  const openAdd = useCallback(() => {
    setEditFaq(null)
    setDrawerOpen(true)
  }, [])
  const openEdit = useCallback((faq: FaqRow) => {
    setEditFaq(faq)
    setDrawerOpen(true)
  }, [])

  const filteredFaqs = useMemo(
    () => filterFaqsBySearch(faqs, searchQuery),
    [faqs, searchQuery]
  )

  const columns = useMemo(
    () =>
      getFaqColumns({
        onEdit: openEdit,
        onDelete: setDeleteFaq,
      }),
    [openEdit]
  )

  const table = useDataTableInstance({
    data: filteredFaqs,
    columns,
    getRowId: (row) => row.id,
    enableRowSelection: false,
  })

  const emptyBody =
    isLoading && faqs.length === 0 ? (
      <TableRow>
        <TableCell colSpan={columns.length} className="h-24 text-center">
          <span className="text-sm text-muted-foreground">Loading FAQs…</span>
        </TableCell>
      </TableRow>
    ) : !isLoading && faqs.length === 0 ? (
      <TableRow>
        <TableCell colSpan={columns.length} className="p-0">
          <div className="flex items-center justify-center p-8">
            <Empty className="bg-muted">
              <EmptyHeader>
                <EmptyTitle>No FAQs yet</EmptyTitle>
                <EmptyDescription>
                  Add FAQs here to show them on the public website. They will
                  appear in the FAQ section immediately after save.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openAdd}>Add FAQ</Button>
              </EmptyContent>
            </Empty>
          </div>
        </TableCell>
      </TableRow>
    ) : !isLoading && filteredFaqs.length === 0 && searchQuery.trim() ? (
      <TableRow>
        <TableCell colSpan={columns.length} className="h-24 text-center">
          <span className="text-sm text-muted-foreground">
            No FAQs match your search.
          </span>
        </TableCell>
      </TableRow>
    ) : undefined

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-0">
      <div className="flex shrink-0 flex-col border-b bg-background px-4 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">FAQ</h2>
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
              aria-label={
                searchQuery.trim()
                  ? `${filteredFaqs.length} of ${faqs.length} FAQs`
                  : `${faqs.length} FAQs`
              }
            >
              {searchQuery.trim()
                ? `${filteredFaqs.length}/${faqs.length}`
                : faqs.length}
            </span>
          </div>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search question or answer…"
            focusShortcut="mod+k"
            focusShortcutLabel="⌘K"
          />
          <div className="flex flex-1 items-center gap-2.5" />
          <Button onClick={openAdd} size="lg">
            <Plus className="size-4" />
            Add FAQ
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="mx-4 mt-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">
              Failed to load FAQs. {(error as Error).message}
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

      <FaqFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editFaq={editFaq}
      />

      <AlertDialog
        open={!!deleteFaq}
        onOpenChange={(open) => !open && setDeleteFaq(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ? This will remove it from
              the website after the next refresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="lg"
              onClick={() => deleteFaq && deleteMutation.mutate(deleteFaq.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
