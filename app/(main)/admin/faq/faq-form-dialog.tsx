"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { faqsApi, faqsQueryKeys, type FaqRow } from "@/lib/api/faqs"

const formSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  sort_order: z.coerce.number().int().min(0),
})

type FormValues = z.infer<typeof formSchema>

interface FaqFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editFaq: FaqRow | null
}

export function FaqFormDialog({
  open,
  onOpenChange,
  editFaq,
}: FaqFormDialogProps) {
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      answer: "",
      sort_order: 0,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        question: editFaq?.question ?? "",
        answer: editFaq?.answer ?? "",
        sort_order: editFaq?.sort_order ?? 0,
      })
    }
  }, [open, editFaq, form])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) =>
      faqsApi.createFaq({
        question: data.question,
        answer: data.answer,
        sort_order: data.sort_order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqsQueryKeys.list() })
      toast.success("FAQ added")
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add FAQ")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormValues }) =>
      faqsApi.updateFaq(id, {
        question: data.question,
        answer: data.answer,
        sort_order: data.sort_order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: faqsQueryKeys.list() })
      toast.success("FAQ updated")
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update FAQ")
    },
  })

  const isEditing = !!editFaq
  const isPending = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: FormValues) {
    if (editFaq) {
      updateMutation.mutate({ id: editFaq.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter question" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="answer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Answer</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter answer"
                      rows={4}
                      className="resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort order</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Spinner className="mr-2 size-4" />}
                {isEditing ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
