/* eslint-disable @next/next/no-img-element */
import React from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronDown } from "lucide-react";

interface SearchResult {
  title: string;
  snippet?: string;
  url: string;
  image?: string;
}


export function SearchResultsSection({ search }: { search: SearchResult[] }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex bg-muted items-center justify-between w-full px-4 py-2 text-xs font-medium text-gray-600 rounded-t-lg cursor-pointer transition">
        <span className="flex items-center gap-2 text-muted-foreground/50">
          <Search size={15} /> Search Results
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-y-auto max-h-72 border-x border-b rounded-b-lg overflow-hidden">
        <Card className="border-0 shadow-none text-sm p-0 bg-muted/60 rounded-none">
          <CardContent className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-gray-700">
            {search.map((s, i) => (
              <Card
                key={i}
                className="bg-muted-foreground/5 shadow-sm rounded-lg hover:shadow-md hover:bg-muted-foreground/10 transition"
              >
                {s.image && (
                  <img
                    src={s.image}
                    alt={s.title}
                    className="w-full h-32 object-cover rounded-t-lg"
                  />
                )}
                <CardContent className="p-2 text-sm text-gray-700">
                  <a
                    href={s.url}
                    target="_blank"
                    className="line-clamp-3 text-muted-foreground hover:underline"
                  >
                    {s.title}
                  </a>
                  {s.snippet && (
                    <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-3">
                      {s.snippet}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 truncate">{s.url}</p>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
