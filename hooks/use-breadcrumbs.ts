"use client"

import { useEffect } from "react"

import type { BreadcrumbItem } from "@/stores/breadcrumb/breadcrumb-store"
import { useBreadcrumbStore } from "@/stores/breadcrumb/breadcrumb-store"

/**
 * Sets breadcrumb overrides for the current page. Overrides are cleared on unmount.
 * Use in pages (especially dynamic routes) to show custom labels, e.g. entity names.
 */
export function useBreadcrumbs(items: BreadcrumbItem[]) {
  const setOverrides = useBreadcrumbStore((s) => s.setOverrides)

  useEffect(() => {
    setOverrides(items)
    return () => setOverrides(null)
  }, [items, setOverrides])
}
