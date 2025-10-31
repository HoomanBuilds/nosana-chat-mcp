"use client";
import React from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT } from "@/lib/constants";
import { useModelGroups } from "@/hooks/useModel";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  mcp?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onValueChange,
  className,
  mcp
}) => {
  const modelGroups = useModelGroups();

  return (
    <Select value={value || DEFAULT.MODEL} onValueChange={onValueChange}>
      <SelectTrigger 
        className={cn(
          "text-xs border-muted-foreground/20 font-normal text-muted-foreground/80 h-6 rounded-sm bg-black/5", 
          className,
          mcp && "rounded-none"
        )} 
        data-size="sm"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent className=" w-[250px] border-muted-foreground/10 bg-muted text-muted-foreground/90">
        {modelGroups.map(group => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.models.map(m => (
              <SelectItem
                key={m.value}
                value={m.value}
                disabled={m.disabled}
                className=" data-[state=checked]:bg-black/5 focus:text-muted-foreground focus:bg-muted-foreground/5 flex items-center gap-1"
              >
                {m.icon}
                {m.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};