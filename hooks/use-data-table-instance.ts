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
}: UseDataTableInstanceProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [internalColumnFilters, setInternalColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [pagination, setPagination] = React.useState({
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
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return table
}
