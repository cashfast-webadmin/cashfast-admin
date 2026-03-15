"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CircleAlertIcon,
  CloudUploadIcon,
  Eye,
  ImageIcon,
  Maximize2,
  Minimize2,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useFileUpload, type FileWithPreview } from "@/hooks/use-file-upload"
import { authApi, authQueryKeys } from "@/lib/api/auth"
import {
  blogsApi,
  blogsQueryKeys,
  type BlogRow,
  type BlogStatus,
} from "@/lib/api/blogs"
import { createClient } from "@/lib/supabase/client"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const BLOG_IMAGES_BUCKET = "blog-images"

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

const BLOG_STATUS_OPTIONS: {
  label: string
  value: BlogStatus
  color: string
}[] = [
  { label: "Draft", value: "draft", color: "bg-slate-500" },
  { label: "Published", value: "published", color: "bg-green-500" },
  { label: "Archived", value: "archived", color: "bg-muted-foreground" },
]
const EMPTY_TAGS: { id: string; name: string; slug: string }[] = []

/** Minimal markdown-to-HTML for preview (headings, bold, links, paragraphs). */
function simpleMarkdownToHtml(md: string): string {
  if (!md?.trim()) return ""
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let inParagraph = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const h1 = line.match(/^# (.*)$/)
    const h2 = line.match(/^## (.*)$/)
    const h3 = line.match(/^### (.*)$/)
    if (h1) {
      if (inParagraph) out.push("</p>")
      out.push(
        `<h1 class="text-2xl font-bold mt-4 mb-2">${escapeHtml(h1[1])}</h1>`
      )
      inParagraph = false
    } else if (h2) {
      if (inParagraph) out.push("</p>")
      out.push(
        `<h2 class="text-xl font-semibold mt-4 mb-2">${escapeHtml(h2[1])}</h2>`
      )
      inParagraph = false
    } else if (h3) {
      if (inParagraph) out.push("</p>")
      out.push(
        `<h3 class="text-lg font-semibold mt-3 mb-1">${escapeHtml(h3[1])}</h3>`
      )
      inParagraph = false
    } else if (line.trim() === "") {
      if (inParagraph) out.push("</p>")
      inParagraph = false
    } else {
      if (!inParagraph) out.push("<p class='mb-2'>")
      inParagraph = true
      out.push(escapeHtml(line) + "\n")
    }
  }
  if (inParagraph) out.push("</p>")
  const raw = out.join("")
  return raw
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      "<a href='$2' class='underline text-primary' target='_blank' rel='noopener'>$1</a>"
    )
}
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function BlogPreviewContent({
  title,
  featuredImage,
  excerpt,
  content,
  tags,
}: {
  title: string
  featuredImage: string | undefined
  excerpt: string | undefined
  content: string
  tags: string
}) {
  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  return (
    <article className="space-y-4">
      {title ? (
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h1>
      ) : (
        <p className="text-sm text-muted-foreground italic">No title</p>
      )}
      {featuredImage && (
        <div className="aspect-[16/10] w-full overflow-hidden rounded-md border">
          <img
            src={featuredImage}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {excerpt && (
        <p className="text-base leading-relaxed text-muted-foreground">
          {excerpt}
        </p>
      )}
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_ol]:list-decimal [&_p]:mb-2 [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{
          __html: simpleMarkdownToHtml(content || ""),
        }}
      />
      {tagList.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {tagList.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

export function BlogFormDrawer({
  open,
  onOpenChange,
  editBlog,
}: BlogFormDrawerProps) {
  const queryClient = useQueryClient()
  const [tagText, setTagText] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const clearFilesRef = useRef<() => void>(() => {})
  const isEditing = !!editBlog

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

  const { data: allTagsData } = useQuery({
    queryKey: blogsQueryKeys.tags(),
    queryFn: () => blogsApi.getBlogTags(),
    enabled: open,
  })
  const { data: currentUser } = useQuery({
    queryKey: authQueryKeys.user,
    queryFn: authApi.getUser,
    enabled: open,
  })
  const allTags = allTagsData ?? EMPTY_TAGS

  const uploadFeaturedImage = async (file: File): Promise<string> => {
    const organizationId = currentUser?.organizationId
    if (!organizationId) throw new Error("Organization is missing.")
    const supabase = createClient()
    const ext = file.name.split(".").pop()?.toLowerCase() || "png"
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 80)
    const path = `${organizationId}/${crypto.randomUUID()}-${safeName}`
    const { error } = await supabase.storage
      .from(BLOG_IMAGES_BUCKET)
      .upload(path, file, { upsert: false })
    if (error) throw error
    const { data } = supabase.storage
      .from(BLOG_IMAGES_BUCKET)
      .getPublicUrl(path)
    return data.publicUrl
  }

  const [
    {
      files: uploadFiles,
      isDragging,
      errors: fileErrors,
      removeFile,
      openFileDialog,
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
    },
    clearFiles,
  ] = useFileUpload({
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    accept: "image/*",
    multiple: false,
    onFilesChange: async (files) => {
      if (files.length === 0) return
      setUploadError(null)
      setIsUploading(true)
      setUploadProgress(0)
      setImageLoading(true)
      const file = files[0]
      try {
        setUploadProgress(30)
        const publicUrl = await uploadFeaturedImage(file.file as File)
        setUploadProgress(100)
        form.setValue("featured_image", publicUrl)
        setUploadError(null)
        clearFilesRef.current()
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed")
        toast.error("Failed to upload image")
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
        setImageLoading(false)
      }
    },
  })
  clearFilesRef.current = clearFiles

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
      setUploadError(null)
      setUploadProgress(0)
      setIsUploading(false)
      clearFilesRef.current()

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
  }, [open, editBlog, form, allTagsData])

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const organizationId = currentUser?.organizationId
      if (!organizationId) {
        throw new Error("Current user organization is missing.")
      }
      const created = await blogsApi.createBlog(
        {
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
        },
        organizationId
      )
      await syncTags(created.id, tagText, allTags, organizationId)
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
      const organizationId = currentUser?.organizationId
      if (!organizationId) {
        throw new Error("Current user organization is missing.")
      }
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
            ? (editBlog?.published_at ?? new Date().toISOString())
            : null,
      })
      await syncTags(id, tagText, allTags, organizationId)
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

  const isPending = createMutation.isPending || updateMutation.isPending
  const isDirty = form.formState.isDirty

  function handleCancelClick() {
    if (!isEditing && isDirty) {
      setCancelDialogOpen(true)
    } else {
      onOpenChange(false)
    }
  }

  function handleSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isEditing && isDirty) {
      setCancelDialogOpen(true)
      return
    }
    if (!nextOpen) setIsFullScreen(false)
    onOpenChange(nextOpen)
  }

  function handleSaveAsDraft() {
    setCancelDialogOpen(false)
    form.setValue("status", "draft")
    form.handleSubmit(onSubmit)()
  }

  function handleDiscard() {
    setCancelDialogOpen(false)
    onOpenChange(false)
  }

  const statusValue = form.watch("status")
  const statusHint = useMemo(() => {
    if (statusValue === "published") return "Will be visible on the website."
    if (statusValue === "archived")
      return "Hidden from website and kept for history."
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
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className={cn(
            "flex w-full flex-col transition-[width,max-width] duration-200",
            isFullScreen
              ? "fixed inset-0 h-full w-full max-w-full sm:max-w-full"
              : "sm:max-w-2xl"
          )}
        >
          <SheetHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <SheetTitle>
              {isEditing ? "Edit Blog Post" : "Add Blog Post"}
            </SheetTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={isFullScreen ? "Exit full screen" : "Full screen"}
                onClick={() => setIsFullScreen((p) => !p)}
              >
                {isFullScreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="size-4" />
                Preview
              </Button>
              <Button
                className="min-w-18"
                size="lg"
                type="button"
                variant="outline"
                onClick={handleCancelClick}
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
              {isPending && <Spinner className="mr-2 size-4" />}
              {isEditing ? "Update" : "Add"}
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
                            if (!isEditing) {
                              form.setValue(
                                "slug",
                                blogsApi.normalizeSlug(event.target.value)
                              )
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
                          readOnly={isEditing}
                          disabled={isEditing}
                          className={cn(
                            isEditing && "cursor-not-allowed bg-muted"
                          )}
                          onChange={(event) =>
                            !isEditing &&
                            field.onChange(
                              blogsApi.normalizeSlug(event.target.value)
                            )
                          }
                        />
                      </FormControl>
                      {isEditing && (
                        <p className="text-xs text-muted-foreground">
                          Slug cannot be changed when editing.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => {
                    const currentOption = BLOG_STATUS_OPTIONS.find(
                      (s) => s.value === field.value
                    )
                    return (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={(value) =>
                              field.onChange(value as BlogStatus)
                            }
                          >
                            <SelectTrigger className="w-full">
                              {currentOption ? (
                                <span className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "size-2 shrink-0 rounded-full",
                                      currentOption.color
                                    )}
                                  />
                                  <span>{currentOption.label}</span>
                                </span>
                              ) : (
                                <SelectValue placeholder="Select status" />
                              )}
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectGroup>
                                {BLOG_STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    <span className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "size-1.5 rounded-full",
                                          s.color
                                        )}
                                      />
                                      <span>{s.label}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {statusHint}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />

                <FormField
                  control={form.control}
                  name="featured_image"
                  render={({ field }) => {
                    const previewUrl =
                      uploadFiles[0]?.preview ?? (field.value || null)
                    const hasImage = Boolean(previewUrl)
                    return (
                      <FormItem>
                        <FormLabel>Featured image</FormLabel>
                        <div
                          className={cn(
                            "rounded-md border transition-all duration-200",
                            isDragging
                              ? "border-dashed border-primary bg-primary/5"
                              : hasImage
                                ? "border-border bg-background hover:border-primary/50"
                                : "border-dashed border-muted-foreground/25 bg-muted/30 hover:border-primary hover:bg-primary/5"
                          )}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          <input
                            {...getInputProps()}
                            className="sr-only"
                            aria-hidden
                          />

                          {hasImage ? (
                            <div className="relative aspect-[16/10] w-full">
                              {imageLoading && (
                                <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-muted">
                                  <span className="text-sm text-muted-foreground">
                                    Loading…
                                  </span>
                                </div>
                              )}
                              <img
                                src={previewUrl ?? ""}
                                alt="Featured"
                                className={cn(
                                  "h-full w-full object-cover transition-opacity duration-300",
                                  imageLoading ? "opacity-0" : "opacity-100"
                                )}
                                onLoad={() => setImageLoading(false)}
                                onError={() => setImageLoading(false)}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 hover:bg-black/40 hover:opacity-100">
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={openFileDialog}
                                  >
                                    <UploadIcon className="size-4" />
                                    Change
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      if (uploadFiles[0])
                                        removeFile(uploadFiles[0].id)
                                      field.onChange("")
                                    }}
                                  >
                                    <XIcon className="size-4" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              {isUploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <div className="text-sm font-medium text-white">
                                    {Math.round(uploadProgress)}%
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center"
                              onClick={openFileDialog}
                            >
                              <div className="rounded-full bg-primary/10 p-3">
                                <CloudUploadIcon className="size-6 text-primary" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  Upload image or drag and drop
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  PNG, JPG, WebP up to 5MB
                                </p>
                              </div>
                              <Button type="button" variant="outline" size="sm">
                                <ImageIcon className="size-4" />
                                Browse
                              </Button>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Or paste image URL
                        </p>
                        <FormControl>
                          <Input
                            placeholder="https://..."
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              field.onChange(e.target.value)
                              setImageLoading(!!e.target.value)
                            }}
                          />
                        </FormControl>
                        {fileErrors.length > 0 && (
                          <Alert variant="destructive">
                            <CircleAlertIcon className="size-4" />
                            <AlertTitle>File error</AlertTitle>
                            <AlertDescription>
                              {fileErrors.map((msg, i) => (
                                <p key={i}>{msg}</p>
                              ))}
                            </AlertDescription>
                          </Alert>
                        )}
                        {uploadError && (
                          <Alert variant="destructive">
                            <CircleAlertIcon className="size-4" />
                            <AlertTitle>Upload failed</AlertTitle>
                            <AlertDescription>{uploadError}</AlertDescription>
                          </Alert>
                        )}
                        <FormMessage />
                      </FormItem>
                    )
                  }}
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
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content (Markdown)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={14}
                          placeholder={
                            "# Heading\n\nWrite markdown content here..."
                          }
                          className="resize-y font-mono text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <p className="mb-3 text-sm font-medium text-muted-foreground">
                    SEO & metadata
                  </p>
                </div>

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
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden"
          showCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto rounded-md border bg-muted/30 p-6">
            <BlogPreviewContent
              title={form.watch("title")}
              featuredImage={form.watch("featured_image")}
              excerpt={form.watch("excerpt")}
              content={form.watch("content")}
              tags={tagText}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save as draft?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save this post as a draft
              before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscard}>
              Discard
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false)
              }}
            >
              Keep editing
            </Button>
            <AlertDialogAction onClick={handleSaveAsDraft}>
              Save as draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

async function syncTags(
  blogId: string,
  tagText: string,
  existingTags: { id: string; name: string; slug: string }[],
  organizationId: string
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
    const created = await blogsApi.createBlogTag(
      { name, slug: normalized },
      organizationId
    )
    tagIds.push(created.id)
  }

  await blogsApi.setBlogTags(blogId, tagIds)
}
