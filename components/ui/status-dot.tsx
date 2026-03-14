import { cn } from "@/lib/utils"

type StatusDotProps = {
  color: string
  className?: string
}

export function StatusDot({ color, className }: StatusDotProps) {
  return (
    <div
      className={cn("size-2 shrink-0 rounded-full", color, className)}
      aria-hidden
    />
  )
}
