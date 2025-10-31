"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function CenterCard() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Box</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Big Box</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <p>This is a centered large card using shadcn dialog.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
