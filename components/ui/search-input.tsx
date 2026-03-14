"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { useHotkeys } from "react-hotkeys-hook"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Hotkey to focus the search input, e.g. "mod+k". Set to false to disable. */
  focusShortcut?: string | false
  /** Shown in UI as shortcut hint when focusShortcut is set. */
  focusShortcutLabel?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  focusShortcut = "mod+k",
  focusShortcutLabel,
}: SearchInputProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  const focusInput = React.useCallback(() => {
    containerRef.current?.querySelector<HTMLInputElement>("input")?.focus()
  }, [])

  useHotkeys(
    focusShortcut === false ? "mod+shift+alt+ctrl+none" : focusShortcut,
    (e) => {
      e.preventDefault()
      focusInput()
    },
    { enabled: focusShortcut !== false },
    [focusShortcut, focusInput]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Escape") return
    e.preventDefault()
    if (value) {
      onChange("")
    } else {
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div ref={containerRef} className={cn("w-[220px] max-w-xs", className)}>
      <InputGroup className="w-full">
        <InputGroupAddon>
          <SearchIcon className="text-muted-foreground size-4" />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          inputMode="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search"
        />
        {value ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => onChange("")}
              aria-label="Clear search"
            >
              <XIcon className="size-3.5" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : focusShortcut ? (
          <InputGroupAddon align="inline-end">
            <Kbd>{focusShortcutLabel ?? "⌘K"}</Kbd>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </div>
  )
}
