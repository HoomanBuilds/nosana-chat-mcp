import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReasoningSection({ reasoning }: { reasoning: string }) {
  return (
    <Collapsible className="mb-1 px-[1px]">
      <CollapsibleTrigger
        className={cn(
          "border rounded-md bg-muted-foreground/5 border-muted-foreground/5 flex items-center justify-between px-3 mx-1 w-fit py-2 text-xs font-medium gap-2 text-gray-600 cursor-pointer transition"
        )}
      >
        <span className="flex items-center gap-2 text-muted-foreground/50">
          <Sparkles size={15} /> Reasoning
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="mx-1 mt-1 rounded-md border border-muted-foreground/10 overflow-y-auto max-h-52 rounded-b-lg overflow-hidden">
        <Card className="border-0 shadow-none text-sm bg-muted/60 rounded-none">
          <CardContent
            className="text-muted-foreground/80 leading-6 prose prose-sm max-w-none text-left"
            style={{
              padding: "0px",
              paddingRight: "10px",
              paddingLeft: "10px",
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {reasoning}
            </ReactMarkdown>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
