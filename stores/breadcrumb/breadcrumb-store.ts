import { create } from "zustand"

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbState {
  overrides: BreadcrumbItem[] | null
  setOverrides: (items: BreadcrumbItem[] | null) => void
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  overrides: null,
  setOverrides: (items) => set({ overrides: items }),
}))
