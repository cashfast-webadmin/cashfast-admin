import { LeadsTable } from "./leads-table"

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">Leads</h1>
        <p className="text-muted-foreground text-sm">
          View and manage leads from the website and other sources.
        </p>
      </div>
      <LeadsTable />
    </div>
  )
}
