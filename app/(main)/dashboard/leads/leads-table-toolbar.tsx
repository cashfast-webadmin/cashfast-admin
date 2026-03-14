"use client"

import { FilterIcon, FunnelXIcon } from "lucide-react"
import type { Table } from "@tanstack/react-table"

import {
  Filters,
  type FilterFieldGroup,
  type Filter,
} from "@/components/reui/filters"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import { StatusDot } from "@/components/ui/status-dot"
import { leadPriorityOptions, leadStatusOptions } from "@/lib/api/leads"
import type { LeadRow } from "@/lib/api/leads"

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
        hideOperator: true,
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
        hideOperator: true,
        options: leadPriorityOptions.map((opt) => ({
          value: opt.value,
          label: opt.label,
          icon: <StatusDot color={opt.color} />,
        })),
      },
    ],
  },
]

interface LeadsTableToolbarProps {
  table: Table<LeadRow>
  total: number
  searchInputValue: string
  setSearchInputValue: (value: string) => void
  filters: Filter<string>[]
  handleFiltersChange: (filters: Filter<string>[]) => void
  clearFilters: () => void
  hasActiveFilters: boolean
}

export function LeadsTableToolbar({
  table,
  total,
  searchInputValue,
  setSearchInputValue,
  filters,
  handleFiltersChange,
  clearFilters,
  hasActiveFilters,
}: LeadsTableToolbarProps) {
  return (
    <div className="flex shrink-0 flex-col border-b bg-background px-4 py-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">Leads</h2>
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
            aria-label={`${total} total leads`}
          >
            {total}
          </span>
        </div>
        <SearchInput
          value={searchInputValue}
          onChange={setSearchInputValue}
          placeholder="Search name, email, phone…"
          focusShortcut="mod+k"
          focusShortcutLabel="⌘K"
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
                <FilterIcon className="size-4" />
                Filters
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
  )
}
