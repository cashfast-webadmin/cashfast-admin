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
import {
  leadsApi,
  leadsQueryKeys,
  leadPriorityOptions,
  leadStatusOptions,
} from "@/lib/api/leads"
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
      {
        key: "priority",
        label: "Priority",
        type: "multiselect",
        searchable: true,
        className: "w-[220px]",
        options: leadPriorityOptions.map((opt) => ({
          value: opt.value,
          label: opt.label,
          icon: <StatusDot color={opt.color} />,
        })),
      },
    ],
  },
]

const statusParser = parseAsArrayOf(parseAsString).withDefault([])
const priorityParser = parseAsArrayOf(parseAsString).withDefault([])
const searchParser = parseAsString.withDefault("")

export function LeadsTable() {
  const [status, setStatus] = useQueryState("status", statusParser)
  const [priority, setPriority] = useQueryState("priority", priorityParser)
  const [search, setSearch] = useQueryState("search", searchParser)

  const {
    data: leads = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: leadsQueryKeys.list,
    queryFn: leadsApi.getLeads,
  })

  const columnFilters = useMemo(() => {
    const entries: { id: string; value: string[] }[] = []
    if (status.length > 0) entries.push({ id: "status", value: status })
    if (priority.length > 0) entries.push({ id: "priority", value: priority })
    return entries
  }, [status, priority])

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
      const priorityEntry = next.find((f) => f.id === "priority")
      const nextPriority = priorityEntry?.value
        ? Array.isArray(priorityEntry.value)
          ? priorityEntry.value
          : [priorityEntry.value]
        : []
      setPriority(nextPriority.length > 0 ? nextPriority : null)
    },
    globalFilter: search,
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === "function" ? updater(search) : updater
      setSearch(next || null)
    },
  })

  const filters: Filter<string>[] = useMemo(() => {
    const result: Filter<string>[] = []
    if (status.length > 0)
      result.push({
        id: "status",
        field: "status",
        operator: "is_any_of",
        values: status,
      })
    if (priority.length > 0)
      result.push({
        id: "priority",
        field: "priority",
        operator: "is_any_of",
        values: priority,
      })
    return result
  }, [status, priority])

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

  const clearFilters = useCallback(() => {
    setStatus(null)
    setPriority(null)
    setSearch(null)
  }, [setStatus, setPriority, setSearch])

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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Leads</h2>
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
                aria-label={`${leads.length} total leads`}
              >
                {leads.length}
              </span>
            </div>
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

            <DataTableViewOptions table={table} />
          </div>
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
