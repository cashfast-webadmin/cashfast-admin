"use client"

import { useEffect, useRef } from "react"
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { DataTable } from "@/components/data-table/data-table"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { useLeadsTableState } from "@/hooks/use-leads-table-state"
import { leadsApi, leadsQueryKeys } from "@/lib/api/leads"
import { LeadDetailPanel } from "./lead-detail-panel"
import { leadsColumns } from "./columns"
import { LeadsTableToolbar } from "./leads-table-toolbar"

const INFINITE_PAGE_SIZE = 20

export function LeadsTable() {
  const {
    params,
    searchInputValue,
    setSearchInputValue,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    filters,
    handleFiltersChange,
    clearFilters,
    hasActiveFilters,
  } = useLeadsTableState()

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: leadsQueryKeys.list({ ...params, pageSize: INFINITE_PAGE_SIZE }),
    queryFn: ({ pageParam }) =>
      leadsApi.getLeads({
        ...params,
        page: pageParam,
        pageSize: INFINITE_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0)
      return loaded < lastPage.total ? allPages.length : undefined
    },
    placeholderData: keepPreviousData,
  })

  const leads = data?.pages.flatMap((p) => p.data) ?? []
  const total = data?.pages[0]?.total ?? 0

  const showInitialLoading = (isLoading || isFetching) && leads.length === 0

  const table = useDataTableInstance({
    data: leads,
    columns: leadsColumns,
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: 1,
    pagination: { pageIndex: 0, pageSize: Math.max(leads.length, 1) },
    sorting: [{ id: sortBy, desc: sortOrder === "desc" }],
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater([{ id: sortBy, desc: sortOrder === "desc" }])
          : updater
      const first = next[0]
      if (first) {
        const validSortBy =
          first.id === "created_at" ||
          first.id === "loan_amount" ||
          first.id === "name"
            ? first.id
            : "created_at"
        setSortBy(validSortBy)
        setSortOrder(first.desc ? "desc" : "asc")
      }
    },
  })

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasNextPage || isFetchingNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage()
      },
      { rootMargin: "200px", threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-0">
      <LeadsTableToolbar
        table={table}
        total={total}
        searchInputValue={searchInputValue}
        setSearchInputValue={setSearchInputValue}
        filters={filters}
        handleFiltersChange={handleFiltersChange}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">
              Failed to load leads. {(error as Error).message}
            </p>
          </div>
        ) : showInitialLoading ? (
          <div className="flex items-center justify-center rounded-md border border-dashed py-12">
            <p className="text-sm text-muted-foreground">Loading leads…</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex items-center justify-center">
            <Empty className="bg-muted">
              <EmptyHeader>
                <EmptyTitle>
                  {hasActiveFilters ? "No results found" : "No leads yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasActiveFilters
                    ? "No leads match your search or filters. Try adjusting your criteria."
                    : "Leads from your website and forms will appear here."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <>
            <DataTable
              table={table}
              columns={leadsColumns}
              renderExpandedRow={(row) => <LeadDetailPanel row={row} />}
              stickyHeader
            />
            {hasNextPage ? (
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center py-4"
              >
                {isFetchingNextPage ? (
                  <p className="text-sm text-muted-foreground">Loading more…</p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
