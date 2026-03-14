"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  blogsApi,
  blogsQueryKeys,
  type BlogRow,
  type BlogStatus,
} from "@/lib/api/blogs"

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  excerpt: z.string().optional(),
  featured_image: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  status: z.enum(["draft", "published", "archived"] as const),
})

type FormValues = z.infer<typeof formSchema>

interface BlogFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editBlog: BlogRow | null
}

const STATUS_OPTIONS: { label: string; value: BlogStatus }[] = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
]

export function BlogFormDrawer({
  open,
  onOpenChange,
  editBlog,
}: BlogFormDrawerProps) {
  const queryClient = useQueryClient()
  const [tagText, setTagText] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "",
      featured_image: "",
      seo_title: "",
      seo_description: "",
      content: "",
      status: "draft",
    },
  })

  const { data: allTags = [] } = useQuery({
    queryKey: blogsQueryKeys.tags(),
    queryFn: () => blogsApi.getBlogTags(),
    enabled: open,
  })

  useEffect(() => {
    async function hydrate() {
      if (!open) return
      form.reset({
        title: editBlog?.title ?? "",
        slug: editBlog?.slug ?? "",
        excerpt: editBlog?.excerpt ?? "",
        featured_image: editBlog?.featured_image ?? "",
        seo_title: editBlog?.seo_title ?? "",
        seo_description: editBlog?.seo_description ?? "",
        content: editBlog?.content ?? "",
        status: editBlog?.status ?? "draft",
      })

      if (!editBlog) {
        setTagText("")
        return
      }

      try {
        const tagIds = await blogsApi.getTagIdsForBlog(editBlog.id)
        const names = allTags
          .filter((tag) => tagIds.includes(tag.id))
          .map((tag) => tag.name)
        setTagText(names.join(", "))
      } catch {
        setTagText("")
      }
    }
    hydrate()
  }, [open, editBlog, form, allTags])

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const created = await blogsApi.createBlog({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        featured_image: data.featured_image || null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        content: data.content,
        status: data.status,
        published_at:
          data.status === "published" ? new Date().toISOString() : null,
      })
      await syncTags(created.id, tagText, allTags)
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs", "list"] })
      queryClient.invalidateQueries({ queryKey: blogsQueryKeys.tags() })
      toast.success("Blog post created")
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create blog")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormValues }) => {
      await blogsApi.updateBlog(id, {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        featured_image: data.featured_image || null,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        content: data.content,
        status: data.status,
        published_at:
          data.status === "published"
            ? editBlog?.published_at ?? new Date().toISOString()
            : null,
      })
      await syncTags(id, tagText, allTags)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blogs", "list"] })
      queryClient.invalidateQueries({ queryKey: blogsQueryKeys.tags() })
      toast.success("Blog post updated")
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update blog")
    },
  })

  const isEditing = !!editBlog
  const isPending = createMutation.isPending || updateMutation.isPending

  const statusValue = form.watch("status")
  const statusHint = useMemo(() => {
    if (statusValue === "published") return "Will be visible on the website."
    if (statusValue === "archived") return "Hidden from website and kept for history."
    return "Saved as draft and hidden from website."
  }, [statusValue])

  function onSubmit(data: FormValues) {
    if (editBlog) {
      updateMutation.mutate({ id: editBlog.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col sm:max-w-xl"
      >
        <SheetHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <SheetTitle>{isEditing ? "Edit Blog Post" : "Add Blog Post"}</SheetTitle>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              className="min-w-18"
              size="lg"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="min-w-18"
              size="lg"
              type="submit"
              form="blog-form"
              disabled={isPending}
            >
              {isPending ? "Saving…" : isEditing ? "Update" : "Add"}
            </Button>
          </div>
        </SheetHeader>
        <Form {...form}>
          <form
            id="blog-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 overflow-hidden"
          >
            <div className="flex-1 space-y-4 overflow-y-auto p-4 pr-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="How to improve loan approval rates"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event)
                          const next = event.target.value
                          if (!form.getValues("slug")) {
                            form.setValue("slug", blogsApi.normalizeSlug(next))
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="improve-loan-approval-rates"
                        {...field}
                        onChange={(event) =>
                          field.onChange(blogsApi.normalizeSlug(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value as BlogStatus)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{statusHint}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="excerpt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Excerpt</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Short summary shown in blog listing..."
                        className="resize-y"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Tags (comma separated)</FormLabel>
                <FormControl>
                  <Input
                    value={tagText}
                    onChange={(event) => setTagText(event.target.value)}
                    placeholder="loans, finance, growth"
                  />
                </FormControl>
              </FormItem>

              <FormField
                control={form.control}
                name="featured_image"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Featured image URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seo_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SEO title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SEO optimized title"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seo_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SEO description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="SEO description for search snippets..."
                        className="resize-y"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content (Markdown)</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={14}
                        placeholder={"# Heading\n\nWrite markdown content here..."}
                        className="resize-y font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

async function syncTags(
  blogId: string,
  tagText: string,
  existingTags: { id: string; name: string; slug: string }[]
) {
  const rawNames = tagText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const uniqueNames = Array.from(new Set(rawNames))
  const tagIds: string[] = []

  for (const name of uniqueNames) {
    const normalized = blogsApi.normalizeSlug(name)
    const existing = existingTags.find((tag) => tag.slug === normalized)
    if (existing) {
      tagIds.push(existing.id)
      continue
    }
    const created = await blogsApi.createBlogTag({ name, slug: normalized })
    tagIds.push(created.id)
  }

  await blogsApi.setBlogTags(blogId, tagIds)
}
