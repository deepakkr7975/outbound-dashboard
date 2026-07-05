"use client"

import {
  contentToHtml,
  substitutePreviewVariables,
} from "@/lib/editor-utils"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  MoreVerticalCircle01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"

interface GmailEmailPreviewProps {
  subject: string
  body: string
  variant?: "a" | "b"
  senderName?: string
  senderEmail?: string
  recipientName?: string
  className?: string
}

export function GmailEmailPreview({
  subject,
  body,
  variant,
  senderName = "Alex Morgan",
  senderEmail = "alex@revtrix.in",
  recipientName = "Emma Davis",
  className,
}: GmailEmailPreviewProps) {
  const previewSubject = substitutePreviewVariables(subject)
  const htmlBody = contentToHtml(substitutePreviewVariables(body))
  const initials = senderName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[#dadce0] bg-white text-[#202124] shadow-sm",
        className
      )}
    >
      {/* Gmail chrome */}
      <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-[#f2f2f2] px-3 py-2">
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          className="size-4 text-[#5f6368]"
        />
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <HugeiconsIcon
            icon={StarIcon}
            strokeWidth={2}
            className="size-4 shrink-0 text-[#5f6368]"
          />
          <span className="truncate text-sm font-medium text-[#202124]">
            {previewSubject || "(No subject)"}
          </span>
        </div>
        <HugeiconsIcon
          icon={MoreVerticalCircle01Icon}
          strokeWidth={2}
          className="size-4 text-[#5f6368]"
        />
      </div>

      {/* Subject */}
      <div className="border-b border-[#e8eaed] px-4 py-3">
        <div className="flex items-start gap-2">
          <h4 className="flex-1 text-xl font-normal leading-snug text-[#202124]">
            {previewSubject || "(No subject)"}
          </h4>
          {variant && (
            <span className="shrink-0 rounded bg-[#e8f0fe] px-2 py-0.5 text-[10px] font-medium text-[#1a73e8]">
              Variant {variant.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Sender row */}
      <div className="flex gap-3 px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-sm font-medium text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-[#202124]">
              {senderName}
            </span>
            <span className="text-xs text-[#5f6368]">&lt;{senderEmail}&gt;</span>
          </div>
          <div className="mt-0.5 text-xs text-[#5f6368]">
            to <span className="text-[#202124]">{recipientName}</span>
          </div>
        </div>
        <span className="shrink-0 text-xs text-[#5f6368]">10:42 AM</span>
      </div>

      {/* Body */}
      <div
        className="gmail-preview-body border-t border-[#e8eaed] px-4 py-4 text-sm leading-relaxed text-[#202124]"
        dangerouslySetInnerHTML={{ __html: htmlBody }}
      />
    </div>
  )
}