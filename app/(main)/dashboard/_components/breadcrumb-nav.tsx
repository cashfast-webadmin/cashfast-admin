"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { sidebarItems } from "@/navigation/sidebar/sidebar-items"
import type { BreadcrumbItem as BreadcrumbItemType } from "@/stores/breadcrumb/breadcrumb-store"
import { useBreadcrumbStore } from "@/stores/breadcrumb/breadcrumb-store"

const urlToLabel = new Map<string, string>()
for (const group of sidebarItems) {
  for (const item of group.items) {
    urlToLabel.set(item.url, item.title)
    for (const sub of item.subItems ?? []) {
      urlToLabel.set(sub.url, sub.title)
    }
  }
}

function formatSegment(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

function getAutoBreadcrumbs(pathname: string): BreadcrumbItemType[] {
  const segments = pathname.split("/").filter(Boolean)
  const items: BreadcrumbItemType[] = []

  if (segments[0] === "dashboard") {
    items.push({ label: "Dashboard", href: "/dashboard/home" })
    segments.shift()
  }

  let path = "/dashboard"
  for (let i = 0; i < segments.length; i++) {
    path += `/${segments[i]}`
    const isLast = i === segments.length - 1
    const label = urlToLabel.get(path) ?? formatSegment(segments[i])
    items.push({ label, href: isLast ? undefined : path })
  }

  return items.length > 0
    ? items
    : [{ label: "Dashboard", href: "/dashboard/home" }]
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const overrides = useBreadcrumbStore((s) => s.overrides)

  const items = overrides ?? getAutoBreadcrumbs(pathname)

  if (items.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.flatMap((item, i) => {
          const isLast = i === items.length - 1
          return [
            <BreadcrumbItem key={`${i}-item`}>
              {isLast ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>,
            ...(!isLast ? [<BreadcrumbSeparator key={`${i}-sep`} />] : []),
          ]
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
