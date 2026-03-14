"use client"

import { useQuery } from "@tanstack/react-query"
import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { leadsApi, leadsQueryKeys } from "@/lib/api/leads"
import { LeadDetailPanel } from "./lead-detail-panel"
import { leadsColumns } from "./columns"

export function LeadsTable() {
  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: leadsQueryKeys.list,
    queryFn: leadsApi.getLeads,
  })

  const table = useDataTableInstance({
    data: leads,
    columns: leadsColumns,
    getRowId: (row) => row.id,
    defaultPageSize: 10,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed py-12">
        <p className="text-muted-foreground text-sm">Loading leads…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
        <p className="text-destructive text-sm">
          Failed to load leads. {(error as Error).message}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <div className="flex flex-col gap-4">
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
