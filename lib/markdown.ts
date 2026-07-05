const VARIABLE_PATTERN = /\{([a-z_]+)\}/g

function wrapVariables(html: string): string {
  return html.replace(
    VARIABLE_PATTERN,
    '<span class="editor-variable" contenteditable="false" data-variable="$1">{$1}</span>'
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>")
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>")
  out = out.replace(/_(.+?)_/g, "<em>$1</em>")
  out = out.replace(/~~(.+?)~~/g, "<s>$1</s>")
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>")
  out = out.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<figure class="editor-image"><img src="$2" alt="$1" /></figure>'
  )
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )
  return wrapVariables(out)
}

export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false
  return (
    /^#{1,3}\s/m.test(text) ||
    /^\s*[-*+]\s/m.test(text) ||
    /^\s*\d+\.\s/m.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /__[^_]+__/.test(text) ||
    /^---$/m.test(text) ||
    /!\[[^\]]*\]\([^)]+\)/.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text)
  )
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push('<hr class="editor-divider" />')
      i++
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4"
      blocks.push(`<${tag}>${inlineMarkdown(heading[2])}</${tag}>`)
      i++
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(
          `<li>${inlineMarkdown(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`
        )
        i++
      }
      blocks.push(`<ul>${items.join("")}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(
          `<li>${inlineMarkdown(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`
        )
        i++
      }
      blocks.push(`<ol>${items.join("")}</ol>`)
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push(`<p>${inlineMarkdown(paraLines.join("<br>"))}</p>`)
  }

  return blocks.length > 0 ? blocks.join("") : "<p><br></p>"
}