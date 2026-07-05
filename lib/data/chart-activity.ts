import chartData from "@/data/chart-activity.json"

export interface ChartActivityPoint {
  date: string
  sends: number
  opens: number
  replies: number
}

export const chartActivity = chartData as ChartActivityPoint[]

export function filterChartByRange(
  data: ChartActivityPoint[],
  startDate: string,
  endDate: string
): ChartActivityPoint[] {
  return data.filter((d) => d.date >= startDate && d.date <= endDate)
}

export function getPresetRange(
  preset: "30d" | "14d" | "7d",
  referenceDate = "2026-07-04"
): { start: string; end: string } {
  const end = new Date(referenceDate + "T12:00:00")
  const start = new Date(end)
  const days = preset === "30d" ? 29 : preset === "14d" ? 13 : 6
  start.setDate(start.getDate() - days)
  return {
    start: start.toISOString().slice(0, 10),
    end: referenceDate,
  }
}