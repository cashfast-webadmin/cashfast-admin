"use client"

import { Monitor as MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { persistPreference } from "@/lib/preferences/preferences-storage"
import { usePreferencesStore } from "@/stores/preferences/preferences-provider"

export function ThemeSwitcher() {
  const theme = usePreferencesStore((s) => s.themeMode)
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode)

  const handleChange = (value: string) => {
    const next = value as typeof theme
    setThemeMode(next)
    persistPreference("theme_mode", next)
  }

  return (
    <div className="py-0">
      <Tabs value={theme} onValueChange={handleChange}>
        <TabsList className="w-full">
          <TabsTrigger value="light" className="h-6 flex-1">
            <SunIcon className="size-4" aria-hidden="true" />
          </TabsTrigger>
          <TabsTrigger value="dark" className="h-6 flex-1">
            <MoonIcon className="size-4" aria-hidden="true" />
          </TabsTrigger>
          <TabsTrigger value="system" className="h-6 flex-1">
            <MonitorIcon className="size-4" aria-hidden="true" />
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
