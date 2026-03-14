"use client"

import type { Row } from "@tanstack/react-table"
import { formatLeadCurrency, formatLeadDate, type LeadRow } from "./columns"

interface LeadDetailPanelProps {
  row: Row<LeadRow>
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  )
}

export function LeadDetailPanel({ row }: LeadDetailPanelProps) {
  const lead = row.original

  return (
    <div className="px-4 py-4">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DetailItem label="Name" value={lead.name} />
        <DetailItem label="Email" value={lead.email} />
        <DetailItem label="Phone" value={lead.phone} />
        <DetailItem label="Loan type" value={lead.loan_type} />
        <DetailItem
          label="Loan amount"
          value={formatLeadCurrency(lead.loan_amount)}
        />
        <DetailItem
          label="Work profile"
          value={lead.work_profile?.replace("_", " ")}
        />
        <DetailItem
          label="Monthly salary"
          value={formatLeadCurrency(lead.monthly_salary)}
        />
        <DetailItem
          label="Annual sales"
          value={formatLeadCurrency(lead.annual_sales)}
        />
        <DetailItem label="Source" value={lead.source} />
        <DetailItem label="Campaign" value={lead.campaign} />
        <DetailItem label="Medium" value={lead.medium} />
        <DetailItem label="Referrer" value={lead.referrer} />
        <DetailItem label="Status" value={lead.status?.replace("_", " ")} />
        <DetailItem label="Priority" value={lead.priority} />
        <DetailItem label="Created" value={formatLeadDate(lead.created_at)} />
        <DetailItem
          label="Last updated"
          value={formatLeadDate(lead.updated_at)}
        />
        <DetailItem
          label="Next follow-up"
          value={formatLeadDate(lead.next_follow_up_at)}
        />
        <DetailItem
          label="Last contacted"
          value={formatLeadDate(lead.last_contacted_at)}
        />
      </div>
      {lead.customer_query && (
        <div className="mt-4 grid gap-1 border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">
            Customer query
          </span>
          <p className="text-sm whitespace-pre-wrap">{lead.customer_query}</p>
        </div>
      )}
      {lead.lead_source_details &&
        typeof lead.lead_source_details === "object" &&
        Object.keys(lead.lead_source_details as object).length > 0 && (
          <div className="mt-4 grid gap-1 border-t border-border pt-4">
            <span className="text-xs font-medium text-muted-foreground">
              Source details
            </span>
            <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              {JSON.stringify(lead.lead_source_details, null, 2)}
            </pre>
          </div>
        )}
    </div>
  )
}
