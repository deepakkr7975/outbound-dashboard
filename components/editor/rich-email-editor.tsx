"use client"

import * as React from "react"

import {
  SlashCommandMenu,
  filterSlashCommands,
  filterVariables,
  type SlashCommandId,
} from "@/components/editor/slash-command-menu"
import { Button } from "@/components/ui/button"
import { contentToHtml } from "@/lib/editor-utils"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  TextStrikethroughIcon,
  LeftToRightListBulletIcon,
} from "@hugeicons/core-free-icons"

interface RichEmailEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}

function getTextBeforeCursor(root: HTMLElement): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return ""

  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer)) return ""

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let text = ""
  let node: Node | null = walker.nextNode()

  while (node) {
    if (node === range.startContainer) {
      text += (node.textContent ?? "").slice(0, range.startOffset)
      break
    }
    text += node.textContent ?? ""
    node = walker.nextNode()
  }

  return text
}

function getCaretViewportPosition(root: HTMLElement): { top: number; left: number } {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    const rect = root.getBoundingClientRect()
    return { top: rect.top + 24, left: rect.left + 16 }
  }

  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(true)

  let rect = range.getBoundingClientRect()

  if (rect.height === 0 && rect.width === 0) {
    const marker = document.createElement("span")
    marker.textContent = "\u200b"
    marker.style.display = "inline"
    range.insertNode(marker)
    rect = marker.getBoundingClientRect()
    marker.remove()
    selection.removeAllRanges()
    selection.addRange(range)
  }

  return {
    top: rect.bottom + 6,
    left: Math.max(8, rect.left),
  }
}

function getSlashMatch(textBefore: string) {
  return textBefore.match(/\/([a-zA-Z0-9_]*)$/)
}

function removeSlashQuery(root: HTMLElement, slashLength: number) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const container = range.startContainer

  if (container.nodeType === Node.TEXT_NODE) {
    const textNode = container as Text
    const offset = range.startOffset
    const before = textNode.textContent?.slice(0, offset) ?? ""
    const slashIndex = before.lastIndexOf("/")
    if (slashIndex === -1) return

    const after = textNode.textContent?.slice(offset) ?? ""
    const newBefore = before.slice(0, slashIndex)
    textNode.textContent = newBefore + after

    const newRange = document.createRange()
    newRange.setStart(textNode, newBefore.length)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
    return
  }

  // Fallback: delete characters backwards
  for (let i = 0; i < slashLength; i++) {
    document.execCommand("delete", false)
  }
}

function insertHtmlAtCursor(html: string) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  range.deleteContents()

  const template = document.createElement("template")
  template.innerHTML = html
  const fragment = template.content
  const lastNode = fragment.lastChild
  range.insertNode(fragment)

  if (lastNode) {
    const newRange = document.createRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
  }
}

export function RichEmailEditor({
  value,
  onChange,
  placeholder = "Write your email… Type / for blocks",
  className,
  minHeight = 220,
}: RichEmailEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null)
  const skipExternalSync = React.useRef(false)
  const variablePickerMode = React.useRef(false)

  const [slashOpen, setSlashOpen] = React.useState(false)
  const [slashQuery, setSlashQuery] = React.useState("")
  const [slashPos, setSlashPos] = React.useState({ top: 0, left: 0 })
  const [slashLength, setSlashLength] = React.useState(0)
  const [showVarPicker, setShowVarPicker] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [formats, setFormats] = React.useState({
    bold: false,
    italic: false,
    underline: false,
  })

  React.useEffect(() => {
    if (skipExternalSync.current) {
      skipExternalSync.current = false
      return
    }
    const el = editorRef.current
    if (!el) return
    const nextHtml = contentToHtml(value)
    if (el.innerHTML !== nextHtml) {
      el.innerHTML = nextHtml
    }
  }, [value])

  function syncContent() {
    const el = editorRef.current
    if (!el) return
    skipExternalSync.current = true
    onChange(el.innerHTML)
  }

  function updateFormatState() {
    setFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
    })
  }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    syncContent()
    updateFormatState()
  }

  function checkSlash() {
    const el = editorRef.current
    if (!el) return

    if (variablePickerMode.current) {
      setSlashOpen(true)
      setShowVarPicker(true)
      setSlashPos(getCaretViewportPosition(el))
      return
    }

    const textBefore = getTextBeforeCursor(el)
    const match = getSlashMatch(textBefore)

    if (match) {
      setSlashOpen(true)
      setShowVarPicker(false)
      setSlashQuery(match[1] ?? "")
      setSlashLength(match[0].length)
      setSlashPos(getCaretViewportPosition(el))
      setActiveIndex(0)
    } else {
      setSlashOpen(false)
      setShowVarPicker(false)
      setSlashQuery("")
      variablePickerMode.current = false
    }
  }

  function closeSlash() {
    setSlashOpen(false)
    setShowVarPicker(false)
    setSlashQuery("")
    setSlashLength(0)
    variablePickerMode.current = false
    setActiveIndex(0)
  }

  function applySlashCommand(id: SlashCommandId) {
    const el = editorRef.current
    if (!el) return

    if (id !== "variable") {
      removeSlashQuery(el, slashLength)
      el.focus()
    }

    if (id === "variable") {
      removeSlashQuery(el, slashLength)
      el.focus()
      variablePickerMode.current = true
      setShowVarPicker(true)
      setSlashOpen(true)
      setSlashQuery("")
      setSlashLength(0)
      setSlashPos(getCaretViewportPosition(el))
      setActiveIndex(0)
      return
    }

    switch (id) {
      case "heading":
        document.execCommand("formatBlock", false, "h2")
        break
      case "subheading":
        document.execCommand("formatBlock", false, "h3")
        break
      case "paragraph":
        document.execCommand("formatBlock", false, "p")
        break
      case "bullet":
        document.execCommand("insertUnorderedList")
        break
      case "ordered":
        document.execCommand("insertOrderedList")
        break
      case "divider":
        insertHtmlAtCursor('<hr class="editor-divider" /><p><br></p>')
        break
      case "image": {
        const url = window.prompt("Image URL", "https://")
        if (url) {
          insertHtmlAtCursor(
            `<figure class="editor-image"><img src="${url}" alt="" /><figcaption contenteditable="true">Caption (optional)</figcaption></figure><p><br></p>`
          )
        }
        break
      }
    }

    closeSlash()
    syncContent()
  }

  function insertVariable(key: string) {
    const el = editorRef.current
    if (!el) return

    el.focus()
    insertHtmlAtCursor(
      `<span class="editor-variable" contenteditable="false" data-variable="${key}">{${key}}</span>&nbsp;`
    )
    closeSlash()
    syncContent()
  }

  const filteredCommands = filterSlashCommands(slashQuery)
  const filteredVars = filterVariables(slashQuery)
  const itemCount = showVarPicker ? filteredVars.length : filteredCommands.length

  function confirmSlashSelection() {
    if (showVarPicker) {
      if (filteredVars[activeIndex]) insertVariable(filteredVars[activeIndex].key)
    } else if (filteredCommands[activeIndex]) {
      applySlashCommand(filteredCommands[activeIndex].id)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (slashOpen && e.key === "Escape") {
      e.preventDefault()
      closeSlash()
      return
    }

    if (slashOpen && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      confirmSlashSelection()
      return
    }

    if (slashOpen && e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % Math.max(itemCount, 1))
      return
    }

    if (slashOpen && e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(
        (i) => (i - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1)
      )
      return
    }

    if (e.key === "/") {
      requestAnimationFrame(() => {
        checkSlash()
      })
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
        <Button
          type="button"
          variant={formats.bold ? "secondary" : "ghost"}
          size="icon-sm"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("bold")
          }}
          title="Bold"
        >
          <HugeiconsIcon icon={TextBoldIcon} strokeWidth={2} className="size-4" />
        </Button>
        <Button
          type="button"
          variant={formats.italic ? "secondary" : "ghost"}
          size="icon-sm"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("italic")
          }}
          title="Italic"
        >
          <HugeiconsIcon icon={TextItalicIcon} strokeWidth={2} className="size-4" />
        </Button>
        <Button
          type="button"
          variant={formats.underline ? "secondary" : "ghost"}
          size="icon-sm"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("underline")
          }}
          title="Underline"
        >
          <HugeiconsIcon icon={TextUnderlineIcon} strokeWidth={2} className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("strikeThrough")
          }}
          title="Strikethrough"
        >
          <HugeiconsIcon icon={TextStrikethroughIcon} strokeWidth={2} className="size-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("insertUnorderedList")
          }}
          title="Bullet list"
        >
          <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onMouseDown={(e) => {
            e.preventDefault()
            exec("insertOrderedList")
          }}
          title="Numbered list"
        >
          <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} className="size-4" />
        </Button>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          Press <kbd className="rounded border px-1 font-mono">/</kbd> for blocks
        </span>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="editor-content prose prose-sm dark:prose-invert max-w-none px-4 py-3 outline-none"
        style={{ minHeight }}
        onInput={() => {
          syncContent()
          checkSlash()
        }}
        onKeyUp={() => {
          updateFormatState()
          checkSlash()
        }}
        onKeyDown={handleKeyDown}
        onClick={updateFormatState}
      />

      <SlashCommandMenu
        open={slashOpen}
        query={slashQuery}
        position={slashPos}
        activeIndex={activeIndex}
        showVariables={showVarPicker}
        onSelect={applySlashCommand}
        onSelectVariable={insertVariable}
      />
    </div>
  )
}