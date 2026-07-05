import Link from "next/link"

import { Button } from "@/components/ui/button"
import { SheetFooter } from "@/components/ui/sheet"

interface PreviewSheetFooterProps {
  links: { label: string; href: string }[]
}

export function PreviewSheetFooter({ links }: PreviewSheetFooterProps) {
  return (
    <SheetFooter className="flex-row gap-2 border-t p-6 sm:justify-start">
      {links.map((link) => (
        <Button
          key={link.href}
          variant="outline"
          render={<Link href={link.href} />}
        >
          {link.label}
        </Button>
      ))}
    </SheetFooter>
  )
}