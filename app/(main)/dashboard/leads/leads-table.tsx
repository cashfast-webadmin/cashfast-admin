"use client"
"use no memo"

import { Download } from "lucide-react"

import { DataTable } from "@/components/data-table/data-table"
import { DataTablePagination } from "@/components/data-table/data-table-pagination"
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options"
import { Button } from "@/components/ui/button"

import { useDataTableInstance } from "@/hooks/use-data-table-instance"

import { recentLeadsColumns } from "../home/_components/columns.crm"
import { recentLeadsData } from "../home/_components/crm.config"

export function LeadsTable() {
  const table = useDataTableInstance({
    data: recentLeadsData,
    columns: recentLeadsColumns,
    getRowId: (row) => row.id.toString(),
  })

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <DataTable table={table} columns={recentLeadsColumns} />
    </div>
  )
}
