"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  getDate,
  startOfDay,
  endOfDay,
} from "date-fns"
import { BadgeDollarSign, Wallet } from "lucide-react"
import { Bar, BarChart, Line, LineChart, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { leadsApi, leadsQueryKeys } from "@/lib/api/leads"
import type { LeadRow } from "@/lib/api/leads"

import {
  leadsChartConfig,
  leadVolumeChartConfig,
} from "./crm.config"

const lastMonthLabel = format(subMonths(new Date(), 1), "LLLL")

const BUCKET_LABELS = ["1-5", "6-10", "11-15", "16-20", "21-25", "26-31"] as const

function getBucketKey(dayOfMonth: number): (typeof BUCKET_LABELS)[number] {
  if (dayOfMonth <= 5) return "1-5"
  if (dayOfMonth <= 10) return "6-10"
  if (dayOfMonth <= 15) return "11-15"
  if (dayOfMonth <= 20) return "16-20"
  if (dayOfMonth <= 25) return "21-25"
  return "26-31"
}

function aggregateLastMonthChartData(leads: LeadRow[]): { date: string; newLeads: number; disqualified: number }[] {
  const buckets: Record<string, { newLeads: number; disqualified: number }> = {}
  BUCKET_LABELS.forEach((label) => {
    buckets[label] = { newLeads: 0, disqualified: 0 }
  })
  for (const lead of leads) {
    const createdAt = lead.created_at
    if (!createdAt) continue
    const day = getDate(new Date(createdAt))
    const key = getBucketKey(day)
    if (lead.status === "new") buckets[key].newLeads += 1
    else if (lead.status === "lost") buckets[key].disqualified += 1
  }
  return BUCKET_LABELS.map((date) => ({
    date,
    newLeads: buckets[date].newLeads,
    disqualified: buckets[date].disqualified,
  }))
}

function aggregateLeadVolumeByMonth(leads: LeadRow[]): { month: string; leadCount: number }[] {
  const byMonth: Record<string, number> = {}
  for (const lead of leads) {
    const createdAt = lead.created_at
    if (!createdAt) continue
    const monthKey = format(new Date(createdAt), "MMM yyyy")
    byMonth[monthKey] = (byMonth[monthKey] ?? 0) + 1
  }
  const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 12))
  const months: { month: string; leadCount: number }[] = []
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), 11 - i)
    const monthKey = format(d, "MMM yyyy")
    months.push({ month: monthKey, leadCount: byMonth[monthKey] ?? 0 })
  }
  return months
}

const NON_LOST_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "on_hold",
] as const

export function OverviewCards() {
  const lastMonthStart = useMemo(
    () => startOfDay(startOfMonth(subMonths(new Date(), 1))).toISOString(),
    []
  )
  const lastMonthEnd = useMemo(
    () => endOfDay(endOfMonth(subMonths(new Date(), 1))).toISOString(),
    []
  )
  const twelveMonthsStart = useMemo(
    () => startOfMonth(subMonths(new Date(), 12)).toISOString(),
    []
  )
  const nowEnd = useMemo(() => endOfDay(new Date()).toISOString(), [])

  const { data: lastMonthData, isLoading: lastMonthLoading, isError: lastMonthError } = useQuery({
    queryKey: leadsQueryKeys.list({
      created_at_after: lastMonthStart,
      created_at_before: lastMonthEnd,
      pageSize: 1000,
      page: 0,
    }),
    queryFn: () =>
      leadsApi.getLeads({
        created_at_after: lastMonthStart,
        created_at_before: lastMonthEnd,
        pageSize: 1000,
        page: 0,
      }),
  })

  const { data: wonData, isLoading: wonLoading, isError: wonError } = useQuery({
    queryKey: leadsQueryKeys.list({ status: ["won"], pageSize: 1, page: 0 }),
    queryFn: () => leadsApi.getLeads({ status: ["won"], pageSize: 1, page: 0 }),
  })

  const { data: pipelineData, isLoading: pipelineLoading, isError: pipelineError } = useQuery({
    queryKey: leadsQueryKeys.list({
      status: [...NON_LOST_STATUSES],
      pageSize: 1,
      page: 0,
    }),
    queryFn: () =>
      leadsApi.getLeads({
        status: [...NON_LOST_STATUSES],
        pageSize: 1,
        page: 0,
      }),
  })

  const { data: twelveMonthsData, isLoading: twelveMonthsLoading, isError: twelveMonthsError } = useQuery({
    queryKey: leadsQueryKeys.list({
      created_at_after: twelveMonthsStart,
      created_at_before: nowEnd,
      pageSize: 2000,
      page: 0,
    }),
    queryFn: () =>
      leadsApi.getLeads({
        created_at_after: twelveMonthsStart,
        created_at_before: nowEnd,
        pageSize: 2000,
        page: 0,
      }),
  })

  const leadsChartData = useMemo(
    () => (lastMonthData?.data ? aggregateLastMonthChartData(lastMonthData.data) : []),
    [lastMonthData?.data]
  )
  const totalNewLeads = useMemo(() => {
    if (!lastMonthData?.data) return 0
    return lastMonthData.data.filter((l) => l.status === "new").length
  }, [lastMonthData?.data])

  const pipelineCount = pipelineData?.total ?? 0

  const leadVolumeData = useMemo(
    () => (twelveMonthsData?.data ? aggregateLeadVolumeByMonth(twelveMonthsData.data) : []),
    [twelveMonthsData?.data]
  )

  const isLoading = lastMonthLoading || wonLoading || pipelineLoading || twelveMonthsLoading
  const hasError = lastMonthError || wonError || pipelineError || twelveMonthsError

  if (isLoading && !lastMonthData && !wonData && !pipelineData && !twelveMonthsData) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-24 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card>
        <CardHeader>
          <CardTitle>New Leads</CardTitle>
          <CardDescription>Last Month</CardDescription>
        </CardHeader>
        <CardContent className="size-full">
          {hasError || lastMonthError ? (
            <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
              Unable to load
            </div>
          ) : (
            <ChartContainer
              className="size-full min-h-24"
              config={leadsChartConfig}
            >
              <BarChart accessibilityLayer data={leadsChartData} barSize={8}>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  hide
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `${lastMonthLabel}: ${label}`}
                    />
                  }
                />
                <Bar
                  background={{
                    fill: "var(--color-background)",
                    radius: 4,
                    opacity: 0.07,
                  }}
                  dataKey="newLeads"
                  stackId="a"
                  fill="var(--color-newLeads)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="disqualified"
                  stackId="a"
                  fill="var(--color-disqualified)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <span className="text-xl font-semibold tabular-nums">
            {lastMonthError ? "—" : totalNewLeads}
          </span>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div className="w-fit rounded-lg bg-green-500/10 p-2">
            <Wallet className="size-5 text-green-500" />
          </div>
        </CardHeader>
        <CardContent className="flex size-full flex-col justify-between">
          <div className="space-y-1.5">
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Leads in pipeline (non-lost)</CardDescription>
          </div>
          <p className="text-2xl font-medium tabular-nums">
            {pipelineError ? "—" : pipelineCount}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="w-fit rounded-lg bg-destructive/10 p-2">
            <BadgeDollarSign className="size-5 text-destructive" />
          </div>
        </CardHeader>
        <CardContent className="flex size-full flex-col justify-between">
          <div className="space-y-1.5">
            <CardTitle>Won leads</CardTitle>
            <CardDescription>Leads with status Won</CardDescription>
          </div>
          <p className="text-2xl font-medium tabular-nums">
            {wonError ? "—" : (wonData?.total ?? 0)}
          </p>
        </CardContent>
      </Card>

      <Card className="col-span-1 xl:col-span-2">
        <CardHeader>
          <CardTitle>Lead volume</CardTitle>
          <CardDescription>Last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {twelveMonthsError ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Unable to load
            </div>
          ) : (
            <ChartContainer config={leadVolumeChartConfig} className="h-24 w-full">
              <LineChart
                data={leadVolumeData}
                margin={{
                  top: 5,
                  right: 10,
                  left: 10,
                  bottom: 0,
                }}
              >
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  hide
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  strokeWidth={2}
                  dataKey="leadCount"
                  stroke="var(--color-leadCount)"
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Leads created per month
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
