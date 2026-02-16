"use client";
import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT } from "@/lib/constants";
import { useModelGroups } from "@/hooks/useModel";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
  mcp,
}) => {
  const searchParams = useSearchParams();
  const customServiceUrl =
    searchParams.get("custom-service_url") ||
    searchParams.get("custom_service_url") ||
    searchParams.get("service_url");
  const customModelFromUrl =
    searchParams.get("custom-model") ||
    searchParams.get("custom_model") ||
    searchParams.get("service_model") ||
    searchParams.get("model");

  const lockedModel = useMemo(() => {
    if (!customServiceUrl) return undefined;
    return customModelFromUrl || value || DEFAULT.MODEL;
  }, [customServiceUrl, customModelFromUrl, value]);

  const { groups: modelGroups, isLoading } = useModelGroups({
    onlyModel: lockedModel,
  });

  useEffect(() => {
    if (!lockedModel) return;
    if (value !== lockedModel) {
      onValueChange(lockedModel);
    }
  }, [lockedModel, onValueChange, value]);

  const selectedValue = lockedModel || value || DEFAULT.MODEL;

  return (
    <Select value={selectedValue} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "text-xs border-muted-foreground/20 font-normal text-muted-foreground/80 h-6 rounded-sm bg-black/5",
          className,
          mcp && "rounded-none",
        )}
        data-size="sm"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>

      <SelectContent className=" w-[250px] border-muted-foreground/10 bg-muted text-muted-foreground/90">
        {modelGroups.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.models.map((m) => (
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
