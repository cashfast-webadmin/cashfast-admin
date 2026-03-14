"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs"
import type { Filter } from "@/components/reui/filters"
import type { GetLeadsParams } from "@/lib/api/leads"

const statusParser = parseAsArrayOf(parseAsString).withDefault([])
const priorityParser = parseAsArrayOf(parseAsString).withDefault([])
const searchParser = parseAsString.withDefault("")
const sortByParser = parseAsStringLiteral([
  "created_at",
  "loan_amount",
  "name",
]).withDefault("created_at")
const sortOrderParser = parseAsStringLiteral(["asc", "desc"]).withDefault(
  "desc"
)

export {
  statusParser,
  priorityParser,
  searchParser,
  sortByParser,
  sortOrderParser,
}

const SEARCH_DEBOUNCE_MS = 300

export function useLeadsTableState() {
  const [status, setStatus] = useQueryState("status", statusParser)
  const [priority, setPriority] = useQueryState("priority", priorityParser)
  const [search, setSearch] = useQueryState("search", searchParser)
  const [sortBy, setSortBy] = useQueryState("sortBy", sortByParser)
  const [sortOrder, setSortOrder] = useQueryState("sortOrder", sortOrderParser)

  const [searchInputValue, setSearchInputValue] = useState("")

  useEffect(() => {
    setSearchInputValue(search ?? "")
  }, [search])

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const committed = search ?? ""
    if (searchInputValue === committed) return

    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null
      setSearch(searchInputValue || null)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
    }
  }, [searchInputValue, search])

  /** Base params for list query (no page/pageSize; used for infinite query key and fetch). */
  const params = useMemo(
    () => ({
      search: search || undefined,
      status: status.length > 0 ? status : undefined,
      priority: priority.length > 0 ? priority : undefined,
      sortBy,
      sortOrder,
    }),
    [search, status, priority, sortBy, sortOrder]
  )

  const hasActiveFilters =
    status.length > 0 || priority.length > 0 || (search?.length ?? 0) > 0

  const clearFilters = useCallback(() => {
    setStatus(null)
    setPriority(null)
    setSearch(null)
  }, [setStatus, setPriority, setSearch])

  /** Filter keys that are always shown in the toolbar (with or without values). */
  const defaultFilterFields = useMemo(
    () => [
      {
        id: "status",
        field: "status" as const,
        operator: "is_any_of" as const,
      },
      {
        id: "priority",
        field: "priority" as const,
        operator: "is_any_of" as const,
      },
    ],
    []
  )

  const filters: Filter<string>[] = useMemo(() => {
    return defaultFilterFields.map(({ id, field, operator }) => ({
      id,
      field,
      operator,
      values: field === "status" ? status : priority,
    }))
  }, [defaultFilterFields, status, priority])

  const handleFiltersChange = useCallback(
    (newFilters: Filter<string>[]) => {
      const statusFilter = newFilters.find((f) => f.field === "status")
      const nextStatus = statusFilter?.values ?? []
      setStatus(nextStatus.length > 0 ? nextStatus : null)
      const priorityFilter = newFilters.find((f) => f.field === "priority")
      const nextPriority = priorityFilter?.values ?? []
      setPriority(nextPriority.length > 0 ? nextPriority : null)
    },
    [setStatus, setPriority]
  )

  return {
    status,
    setStatus,
    priority,
    setPriority,
    search,
    setSearch,
    searchInputValue,
    setSearchInputValue,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    params,
    hasActiveFilters,
    clearFilters,
    filters,
    handleFiltersChange,
  }
}
