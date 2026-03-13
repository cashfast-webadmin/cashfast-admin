"use client"

import type { ReactNode } from "react"
import { useState } from "react"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { PreferencesState } from "@/stores/preferences/preferences-store"
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider"

type AppProvidersProps = {
  children: ReactNode
  themeMode: PreferencesState["themeMode"]
  themePreset: PreferencesState["themePreset"]
  font: PreferencesState["font"]
  contentLayout: PreferencesState["contentLayout"]
  navbarStyle: PreferencesState["navbarStyle"]
}

export function AppProviders({
  children,
  themeMode,
  themePreset,
  font,
  contentLayout,
  navbarStyle,
}: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesStoreProvider
        themeMode={themeMode}
        themePreset={themePreset}
        contentLayout={contentLayout}
        navbarStyle={navbarStyle}
        font={font}
      >
        {children}
      </PreferencesStoreProvider>
    </QueryClientProvider>
  )
}

