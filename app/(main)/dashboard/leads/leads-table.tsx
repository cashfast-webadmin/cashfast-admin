"use client"

import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ListFilterIcon, FunnelXIcon } from "lucide-react"
import {
  createFilter,
  Filters,
  type Filter,
  type FilterFieldGroup,
} from "@/components/reui/filters"
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { leadsApi, leadsQueryKeys, leadStatusOptions } from "@/lib/api/leads"
import { StatusDot } from "@/components/ui/status-dot"
import { LeadDetailPanel } from "./lead-detail-panel"
import { leadsColumns } from "./columns"

const leadFilterFields: FilterFieldGroup<string>[] = [
  {
    group: "Leads",
    fields: [
      {
        key: "status",
        label: "Status",
        type: "multiselect",
        searchable: true,
        className: "w-[220px]",
        options: leadStatusOptions.map((opt) => ({
          value: opt.value,
          label: opt.label,
          icon: <StatusDot color={opt.color} />,
        })),
      },
    ],
  },
]

const statusParser = parseAsArrayOf(parseAsString).withDefault([])
const searchParser = parseAsString.withDefault("")

export function LeadsTable() {
  const [status, setStatus] = useQueryState("status", statusParser)
  const [search, setSearch] = useQueryState("search", searchParser)

  const {
    data: leads = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: leadsQueryKeys.list,
    queryFn: leadsApi.getLeads,
  })

  const columnFilters = useMemo(
    () => (status.length > 0 ? [{ id: "status" as const, value: status }] : []),
    [status]
  )

  const table = useDataTableInstance({
    data: leads,
    columns: leadsColumns,
    getRowId: (row) => row.id,
    defaultPageSize: 10,
    columnFilters,
    onColumnFiltersChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnFilters) : updater
      const statusEntry = next.find((f) => f.id === "status")
      const nextStatus = statusEntry?.value
        ? Array.isArray(statusEntry.value)
          ? statusEntry.value
          : [statusEntry.value]
        : []
      setStatus(nextStatus.length > 0 ? nextStatus : null)
    },
    globalFilter: search,
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === "function" ? updater(search) : updater
      setSearch(next || null)
    },
  })

  const filters: Filter<string>[] = useMemo(
    () =>
      status.length > 0
        ? [
            {
              id: "status",
              field: "status",
              operator: "is_any_of",
              values: status,
            },
          ]
        : [],
    [status]
  )

  const handleFiltersChange = useCallback(
    (newFilters: Filter<string>[]) => {
      const statusFilter = newFilters.find((f) => f.field === "status")
      const nextStatus = statusFilter?.values ?? []
      setStatus(nextStatus.length > 0 ? nextStatus : null)
    },
    [setStatus]
  )

  const clearFilters = useCallback(() => {
    setStatus(null)
    setSearch(null)
  }, [setStatus, setSearch])

  const hasActiveFilters = filters.length > 0 || search.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed py-12">
        <p className="text-sm text-muted-foreground">Loading leads…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
        <p className="text-sm text-destructive">
          Failed to load leads. {(error as Error).message}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <div className="flex flex-col gap-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold tracking-tight">Leads</h2>
            <Input
              placeholder="Search name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value || null)}
              className="w-[220px]"
            />
            <div className="flex flex-1 items-center gap-2.5">
              <Filters
                filters={filters}
                fields={leadFilterFields}
                onChange={handleFiltersChange}
                shortcutKey="f"
                shortcutLabel="F"
                enableShortcut
                trigger={
                  <Button variant="outline" size="sm">
                    <ListFilterIcon className="size-4" />
                    Add filter
                  </Button>
                }
              />
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <FunnelXIcon className="size-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <DataTableViewOptions table={table} />
        </div>
        <DataTable
          table={table}
          columns={leadsColumns}
          renderExpandedRow={(row) => <LeadDetailPanel row={row} />}
        />
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}
