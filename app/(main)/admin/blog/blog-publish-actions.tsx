"use client"

import { Button } from "@/components/ui/button"
import type { BlogRow } from "@/lib/api/blogs"

type BlogPublishActionsProps = {
  blog: BlogRow
  isPending?: boolean
  onPublish: (blog: BlogRow) => void
  onUnpublish: (blog: BlogRow) => void
}

export function BlogPublishActions({
  blog,
  isPending = false,
  onPublish,
  onUnpublish,
}: BlogPublishActionsProps) {
  if (blog.status === "published") {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => onUnpublish(blog)}
      >
        {isPending ? "Saving…" : "Unpublish"}
      </Button>
    )
  }

  return (
    <Button size="sm" disabled={isPending} onClick={() => onPublish(blog)}>
      {isPending ? "Saving…" : "Publish"}
    </Button>
  )
}
