"use client"

import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/types/supabase"

export type BlogRow = Database["public"]["Tables"]["blogs"]["Row"]
export type BlogInsert = Database["public"]["Tables"]["blogs"]["Insert"]
export type BlogUpdate = Database["public"]["Tables"]["blogs"]["Update"]
export type BlogStatus = Database["public"]["Enums"]["blog_status"]
export type BlogTagRow = Database["public"]["Tables"]["blog_tags"]["Row"]
export type BlogTagInsert = Database["public"]["Tables"]["blog_tags"]["Insert"]

export type GetBlogsParams = {
  search?: string
  status?: BlogStatus[]
  sortBy?: "created_at" | "updated_at" | "published_at" | "title"
  sortOrder?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export type GetBlogsResult = {
  data: BlogRow[]
  total: number
}

const SORTABLE_COLUMNS = [
  "created_at",
  "updated_at",
  "published_at",
  "title",
] as const

export const blogsQueryKeys = {
  list: (params: GetBlogsParams) => ["blogs", "list", params] as const,
  detail: (id: string) => ["blogs", id] as const,
  tags: () => ["blogs", "tags"] as const,
  postTags: (blogId: string) => ["blogs", blogId, "tags"] as const,
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function escapeIlikePattern(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/"/g, '""')
}

async function getBlogs(params: GetBlogsParams = {}): Promise<GetBlogsResult> {
  const supabase = createClient()
  const page = params.page ?? 0
  const pageSize = params.pageSize ?? 10
  const sortBy =
    params.sortBy && SORTABLE_COLUMNS.includes(params.sortBy)
      ? params.sortBy
      : "updated_at"
  const ascending = params.sortOrder === "asc"

  let query = supabase.from("blogs").select("*", { count: "exact" })

  if (params.status?.length) {
    query = query.in("status", params.status)
  }

  const search = params.search?.trim()
  if (search) {
    const escaped = escapeIlikePattern(search)
    const pattern = `"%${escaped}%"`
    query = query.or(
      `title.ilike.${pattern},excerpt.ilike.${pattern},seo_title.ilike.${pattern}`
    )
  }

  query = query.order(sortBy, { ascending })
  const from = page * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return {
    data: (data ?? []) as BlogRow[],
    total: count ?? 0,
  }
}

async function getBlogById(id: string): Promise<BlogRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data as BlogRow
}

async function createBlog(
  payload: Omit<BlogInsert, "organization_id">,
  organizationId: string
): Promise<BlogRow> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const insertPayload: BlogInsert = {
    ...payload,
    organization_id: organizationId,
    slug: normalizeSlug(payload.slug || payload.title),
    created_by: payload.created_by ?? user?.id ?? null,
  }

  const { data, error } = await supabase
    .from("blogs")
    // @ts-expect-error -- Supabase generated types can infer insert payload as never for multi-schema Database
    .insert(insertPayload)
    .select("*")
    .single()

  if (error) throw error
  return data as BlogRow
}

async function updateBlog(id: string, payload: BlogUpdate): Promise<void> {
  const supabase = createClient()
  const nextPayload: BlogUpdate = {
    ...payload,
    slug: payload.slug ? normalizeSlug(payload.slug) : undefined,
  }

  const { error } = await supabase
    .from("blogs")
    // @ts-expect-error -- Supabase generated types can infer update payload as never for multi-schema Database
    .update(nextPayload)
    .eq("id", id)
  if (error) throw error
}

async function deleteBlog(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("blogs").delete().eq("id", id)
  if (error) throw error
}

async function publishBlog(id: string): Promise<void> {
  const blog = await getBlogById(id)
  await updateBlog(id, {
    status: "published",
    published_at: new Date().toISOString(),
  })
  await requestWebsiteRevalidate(blog?.slug ?? null)
}

async function unpublishBlog(id: string): Promise<void> {
  const blog = await getBlogById(id)
  await updateBlog(id, { status: "draft", published_at: null })
  await requestWebsiteRevalidate(blog?.slug ?? null)
}

async function getBlogTags(): Promise<BlogTagRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("blog_tags")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  return (data ?? []) as BlogTagRow[]
}

async function createBlogTag(
  payload: Omit<BlogTagInsert, "organization_id">,
  organizationId: string
): Promise<BlogTagRow> {
  const supabase = createClient()
  const insertPayload: BlogTagInsert = {
    ...payload,
    organization_id: organizationId,
    slug: normalizeSlug(payload.slug || payload.name),
  }

  const { data, error } = await supabase
    .from("blog_tags")
    // @ts-expect-error -- Supabase generated types can infer insert payload as never for multi-schema Database
    .insert(insertPayload)
    .select("*")
    .single()
  if (error) throw error
  return data as BlogTagRow
}

async function deleteBlogTag(tagId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("blog_tags").delete().eq("id", tagId)
  if (error) throw error
}

async function getTagIdsForBlog(blogId: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("blog_post_tags")
    .select("tag_id")
    .eq("blog_id", blogId)
  if (error) throw error
  return ((data ?? []) as { tag_id: string }[]).map((row) => row.tag_id)
}

async function setBlogTags(blogId: string, tagIds: string[]): Promise<void> {
  const supabase = createClient()
  const { error: removeError } = await supabase
    .from("blog_post_tags")
    .delete()
    .eq("blog_id", blogId)
  if (removeError) throw removeError

  if (tagIds.length === 0) return

  const { error } = await supabase
    .from("blog_post_tags")
    // @ts-expect-error -- Supabase generated types can infer insert payload as never for multi-schema Database
    .insert(tagIds.map((tagId) => ({ blog_id: blogId, tag_id: tagId })))
  if (error) throw error
}

export const blogsApi = {
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  publishBlog,
  unpublishBlog,
  getBlogTags,
  createBlogTag,
  deleteBlogTag,
  getTagIdsForBlog,
  setBlogTags,
  normalizeSlug,
}

async function requestWebsiteRevalidate(slug: string | null): Promise<void> {
  try {
    await fetch("/api/revalidate-blog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    })
  } catch (error) {
    // Revalidation failures should not block CMS mutations.
    console.warn("Failed to trigger website revalidation:", error)
  }
}
