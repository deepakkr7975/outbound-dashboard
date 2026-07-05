import { looksLikeMarkdown, markdownToHtml } from "@/lib/markdown"

const VARIABLE_PATTERN = /\{([a-z_]+)\}/g

export const PREVIEW_SAMPLE_VARS: Record<string, string> = {
  first_name: "Emma",
  company: "HubSpot",
  role: "Customer Success Manager",
  city: "Boston",
  email: "emma.davis@example.com",
}

export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text.trim())
}

export function plainTextToHtml(text: string): string {
  if (!text) return "<p><br></p>"

  return text
    .split(/\n\n+/)
    .map((block) => {
      const withVars = block.replace(
        VARIABLE_PATTERN,
        '<span class="editor-variable" contenteditable="false" data-variable="$1">{$1}</span>'
      )
      const lines = withVars.split("\n").join("<br>")
      return `<p>${lines || "<br>"}</p>`
    })
    .join("")
}

/** Normalize plain text, markdown, or HTML into editor-ready HTML */
export function contentToHtml(text: string): string {
  if (!text?.trim()) return "<p><br></p>"
  if (isHtmlContent(text)) return text
  if (looksLikeMarkdown(text)) return markdownToHtml(text)
  return plainTextToHtml(text)
}

export function substitutePreviewVariables(
  text: string,
  vars: Record<string, string> = PREVIEW_SAMPLE_VARS
): string {
  return text.replace(VARIABLE_PATTERN, (_, key: string) => vars[key] ?? `{${key}}`)
}

export function stripHtmlToPreview(html: string, maxLength = 160): string {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export const EDITOR_VARIABLES = [
  { key: "first_name", label: "First name" },
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "city", label: "City" },
  { key: "email", label: "Email" },
] as const