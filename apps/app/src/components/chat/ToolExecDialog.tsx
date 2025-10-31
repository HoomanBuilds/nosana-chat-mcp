import { useChatStore } from "@/store/chat.store";
import { Button } from "../ui/button";
import { useState } from "react";
import { ChevronDown, Loader2Icon, PencilIcon, SaveIcon, XIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ToolExecDialog() {
  const { pendingTool, setPendingTool } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [open, setOpen] = useState(false);

  if (!pendingTool) return null;
  const startEditing = () => {
    setEditValue(JSON.stringify(pendingTool.prompt, null, 2));
    setEditing(true);
    setOpen(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue("");
  };

  const saveEdit = () => {
    try {
      const parsed = JSON.parse(editValue);
      setPendingTool({ ...pendingTool, prompt: parsed });
      setEditing(false);
    } catch (err) {
      alert("Invalid JSON: " + (err as Error).message);
    }
  };

  return (
    <div className="bg-muted/70 text-muted-foreground border rounded-lg p-4 my-3 w-full">
      <h3 className="text-base font-semibold mb-2">⚙️ {pendingTool.heading}</h3>

      <Collapsible open={open} onOpenChange={setOpen} className="w-full mb-3 relative group">
        <CollapsibleTrigger
          className={cn(
            "border rounded bg-muted-foreground/5 border-muted-foreground/5 flex items-center justify-between px-3 w-full py-2 text-xs font-medium gap-2 text-gray-600 cursor-pointer transition"
          )}
        >
          <div className="flex flex-col items-start gap-2 text-muted-foreground/50">
            <span className="text-sm text-muted-foreground/80">
              Execute Tool with Arguments:
            </span>
            {!editing && (
              <pre className="text-start text-muted-foreground group-data-[state=open]:hidden line-clamp-6">
                {JSON.stringify(pendingTool.prompt, null, 2)}
              </pre>
            )}
          </div>

          <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform duration-200 group-data-[state=closed]:hidden group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-muted to-transparent opacity-70 transition-opacity group-data-[state=open]:opacity-0" />

        <CollapsibleContent>
          {!editing ? (
            <pre className="bg-muted text-muted-foreground rounded-md tracking-wider p-3 text-sm overflow-x-auto mt-2 font-mono whitespace-pre">
              {JSON.stringify(pendingTool.prompt, null, 2)}
            </pre>
          ) : (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full mt-2 h-64 bg-muted text-muted-foreground rounded-md p-3 font-mono text-sm focus:outline-none border"
            />
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="flex gap-3 w-full">
        {!editing ? (
          <>
            {
              pendingTool.funcName === "createJob" && (
                <Button
                  variant="outline"
                  onClick={startEditing}
                  className="flex-1 rounded cursor-pointer text-muted-foreground/50 hover:text-muted-foreground"
                >
                  <PencilIcon className="h-4 w-4 mr-2" /> Edit Schema
                </Button>
              )
            }

            <Button
              variant="outline"
              onClick={async () => {
                try {
                  setLoading(true);
                  pendingTool.onConfirm();
                } finally {
                  setLoading(false);
                }
              }}

              className="flex-4 rounded cursor-pointer text-muted-foreground/50 hover:text-muted-foreground rotate-none py-2 transition"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> Executing...
                </span>
              ) : (
                <span>Run {pendingTool.funcName}</span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => pendingTool.onCancel()}
              className="flex-1 text-muted-foreground/50 hover:text-muted-foreground py-2 rounded transition cursor-pointer"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={saveEdit}
              className="flex-1 text-green-600 border-green-500 hover:bg-green-50"
            >
              <SaveIcon className="h-4 w-4 mr-2" /> Save
            </Button>
            <Button
              variant="outline"
              onClick={cancelEdit}
              className="flex-1 text-red-600 border-red-500 hover:bg-red-50"
            >
              <XIcon className="h-4 w-4 mr-2" /> Cancel Edit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
