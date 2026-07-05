"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Heading01Icon,
  TextFontIcon,
  CodeIcon,
  Image01Icon,
  LeftToRightListBulletIcon,
  MinusSignIcon,
  Contact01Icon,
} from "@hugeicons/core-free-icons"

export type SlashCommandId =
  | "heading"
  | "subheading"
  | "paragraph"
  | "variable"
  | "image"
  | "bullet"
  | "ordered"
  | "divider"

export interface SlashCommand {
  id: SlashCommandId
  label: string
  description: string
  icon: typeof Heading01Icon
  keywords: string[]
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "heading",
    label: "Heading",
    description: "Large section title",
    icon: Heading01Icon,
    keywords: ["h1", "title", "heading"],
  },
  {
    id: "subheading",
    label: "Subheading",
    description: "Smaller section title",
    icon: TextFontIcon,
    keywords: ["h2", "subtitle", "subheading"],
  },
  {
    id: "paragraph",
    label: "Paragraph",
    description: "Plain text block",
    icon: TextFontIcon,
    keywords: ["text", "p", "body"],
  },
  {
    id: "variable",
    label: "Variable",
    description: "Insert personalization token",
    icon: CodeIcon,
    keywords: ["var", "merge", "token", "personalization"],
  },
  {
    id: "image",
    label: "Image",
    description: "Embed an image block",
    icon: Image01Icon,
    keywords: ["img", "photo", "picture"],
  },
  {
    id: "bullet",
    label: "Bullet list",
    description: "Unordered list",
    icon: LeftToRightListBulletIcon,
    keywords: ["ul", "list"],
  },
  {
    id: "ordered",
    label: "Numbered list",
    description: "Ordered list",
    icon: LeftToRightListBulletIcon,
    keywords: ["ol", "numbered"],
  },
  {
    id: "divider",
    label: "Divider",
    description: "Horizontal rule",
    icon: MinusSignIcon,
    keywords: ["hr", "line", "separator"],
  },
]

const VARIABLES = [
  { key: "first_name", label: "First name" },
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "city", label: "City" },
  { key: "email", label: "Email" },
]

interface SlashCommandMenuProps {
  open: boolean
  query: string
  position: { top: number; left: number }
  activeIndex: number
  onSelect: (id: SlashCommandId) => void
  onSelectVariable?: (key: string) => void
  showVariables?: boolean
}

export function SlashCommandMenu({
  open,
  query,
  position,
  activeIndex,
  onSelect,
  onSelectVariable,
  showVariables = false,
}: SlashCommandMenuProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const filtered = React.useMemo(() => {
    if (!query) return SLASH_COMMANDS
    const q = query.toLowerCase()
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.includes(q))
    )
  }, [query])

  const filteredVars = React.useMemo(() => {
    return VARIABLES.filter(
      (v) =>
        !query ||
        v.key.includes(query.toLowerCase()) ||
        v.label.toLowerCase().includes(query.toLowerCase())
    )
  }, [query])

  if (!open || !mounted) return null

  const menuStyle: React.CSSProperties = {
    top: position.top,
    left: position.left,
    position: "fixed",
  }

  const content = showVariables ? (
    <div
      className="z-[200] w-64 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
      style={menuStyle}
      role="listbox"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        Insert variable
      </div>
      <div className="max-h-56 overflow-y-auto p-1">
        {filteredVars.map((v, i) => (
          <button
            key={v.key}
            type="button"
            role="option"
            aria-selected={i === activeIndex}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
              i === activeIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelectVariable?.(v.key)
            }}
          >
            <HugeiconsIcon icon={Contact01Icon} strokeWidth={2} className="size-4 shrink-0" />
            <div>
              <div className="font-medium">{v.label}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {`{${v.key}}`}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  ) : filtered.length === 0 ? null : (
    <div
      className="z-[200] w-72 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
      style={menuStyle}
      role="listbox"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="border-b px-3 py-2 text-xs text-muted-foreground">
        Type to filter · ↑↓ navigate · Enter to insert
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {filtered.map((cmd, i) => (
          <button
            key={cmd.id}
            type="button"
            role="option"
            aria-selected={i === activeIndex}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
              i === activeIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(cmd.id)
            }}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
              <HugeiconsIcon icon={cmd.icon} strokeWidth={2} className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="font-medium">{cmd.label}</div>
              <div className="truncate text-xs text-muted-foreground">
                {cmd.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  if (!content) return null
  return createPortal(content, document.body)
}

export function filterSlashCommands(query: string) {
  if (!query) return SLASH_COMMANDS
  const q = query.toLowerCase()
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q))
  )
}

export function filterVariables(query: string) {
  return VARIABLES.filter(
    (v) =>
      !query ||
      v.key.includes(query.toLowerCase()) ||
      v.label.toLowerCase().includes(query.toLowerCase())
  )
}