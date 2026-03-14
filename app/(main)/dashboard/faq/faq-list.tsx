"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EllipsisVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { faqsApi, faqsQueryKeys, type FaqRow } from "@/lib/api/faqs"

import { FaqFormDialog } from "./faq-form-dialog"

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen).trim() + "…"
}

export function FaqList() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editFaq, setEditFaq] = useState<FaqRow | null>(null)
  const [deleteFaq, setDeleteFaq] = useState<FaqRow | null>(null)

  const { data: faqs = [], isLoading, error } = useQuery({
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

  const openAdd = () => {
    setEditFaq(null)
    setFormOpen(true)
  }
  const openEdit = (faq: FaqRow) => {
    setEditFaq(faq)
    setFormOpen(true)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-0">
      <div className="flex shrink-0 flex-col border-b bg-background px-4 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-semibold tracking-tight">FAQ</h2>
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
            aria-label={`${faqs.length} FAQs`}
          >
            {faqs.length}
          </span>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            Add FAQ
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">
              Failed to load FAQs. {(error as Error).message}
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center rounded-md border border-dashed py-12">
            <p className="text-sm text-muted-foreground">Loading FAQs…</p>
          </div>
        ) : faqs.length === 0 ? (
          <Empty className="bg-muted">
            <EmptyHeader>
              <EmptyTitle>No FAQs yet</EmptyTitle>
              <EmptyDescription>
                Add FAQs here to show them on the public website. They will
                appear in the FAQ section and refresh daily.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={openAdd}>Add FAQ</Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {faqs.map((faq) => (
              <li key={faq.id}>
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <p className="text-sm font-medium leading-tight">
                      {faq.question}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <span className="sr-only">Actions</span>
                          <EllipsisVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(faq)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteFaq(faq)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      {truncate(faq.answer, 120)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Order: {faq.sort_order}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FaqFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFaq && deleteMutation.mutate(deleteFaq.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
