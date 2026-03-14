"use no memo"
import * as React from "react"

import {
  type ColumnDef,
  type ColumnFiltersState,
  type Updater,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"

type UseDataTableInstanceProps<TData, TValue> = {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  enableRowSelection?: boolean
  defaultPageIndex?: number
  defaultPageSize?: number
  getRowId?: (row: TData, index: number) => string
  /** When provided, column filters are controlled (e.g. from URL state). */
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: (updater: Updater<ColumnFiltersState>) => void
  /** When provided, global filter (e.g. search) is controlled (e.g. from URL state). */
  globalFilter?: string
  onGlobalFilterChange?: (updater: Updater<string>) => void
  /** Server-side: data is already filtered/sorted/paginated; table only displays. */
  manualPagination?: boolean
  manualSorting?: boolean
  manualFiltering?: boolean
  /** Total number of pages (required when manualPagination is true). */
  pageCount?: number
  /** Controlled pagination state (use with manualPagination). */
  pagination?: { pageIndex: number; pageSize: number }
  onPaginationChange?: (updater: Updater<{ pageIndex: number; pageSize: number }>) => void
  /** Controlled sorting state (use with manualSorting). */
  sorting?: SortingState
  onSortingChange?: (updater: Updater<SortingState>) => void
}

export function useDataTableInstance<TData, TValue>({
  data,
  columns,
  enableRowSelection = true,
  defaultPageIndex,
  defaultPageSize,
  getRowId,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange: controlledOnColumnFiltersChange,
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange: controlledOnGlobalFilterChange,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  pageCount,
  pagination: controlledPagination,
  onPaginationChange: controlledOnPaginationChange,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
}: UseDataTableInstanceProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [internalColumnFilters, setInternalColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("")
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [internalPagination, setInternalPagination] = React.useState({
    pageIndex: defaultPageIndex ?? 0,
    pageSize: defaultPageSize ?? 10,
  })

  const columnFilters =
    controlledColumnFilters !== undefined
      ? controlledColumnFilters
      : internalColumnFilters
  const setColumnFilters =
    controlledOnColumnFiltersChange ?? setInternalColumnFilters
  const globalFilter =
    controlledGlobalFilter !== undefined
      ? controlledGlobalFilter
      : internalGlobalFilter
  const setGlobalFilter =
    controlledOnGlobalFilterChange ?? setInternalGlobalFilter
  const sorting =
    controlledSorting !== undefined ? controlledSorting : internalSorting
  const setSorting = controlledOnSortingChange ?? setInternalSorting
  const pagination =
    controlledPagination !== undefined ? controlledPagination : internalPagination
  const setPagination =
    controlledOnPaginationChange ?? setInternalPagination

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      expanded,
      pagination,
    },
    enableRowSelection,
    getRowId: getRowId ?? ((row) => (row as any).id.toString()),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: (updater) =>
      setExpanded((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        return typeof next === "object" && next !== null ? next : {}
      }),
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: manualFiltering ? undefined : getFacetedRowModel(),
    getFacetedUniqueValues:
      manualFiltering ? undefined : getFacetedUniqueValues(),
    manualPagination: manualPagination ?? false,
    manualSorting: manualSorting ?? false,
    manualFiltering: manualFiltering ?? false,
    pageCount: pageCount ?? (manualPagination ? -1 : undefined),
  })

  return table
}
