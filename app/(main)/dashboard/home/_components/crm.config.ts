import type { ChartConfig } from "@/components/ui/chart"

export const leadsChartConfig = {
  newLeads: {
    label: "New Leads",
    color: "var(--chart-1)",
  },
  disqualified: {
    label: "Disqualified",
    color: "var(--chart-3)",
  },
  background: {
    color: "var(--primary)",
  },
} as ChartConfig

/** Config for Lead volume line chart (leads per month). */
export const leadVolumeChartConfig = {
  leadCount: {
    label: "Leads",
    color: "var(--chart-1)",
  },
} as ChartConfig
