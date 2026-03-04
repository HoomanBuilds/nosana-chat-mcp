"use client";
import React from "react";
import { cn } from "@/lib/utils";

interface FeatureToggleProps {
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  activeColor?: string;
  className?: string;
}

export const FeatureToggle: React.FC<FeatureToggleProps> = ({
  icon,
  isActive,
  onClick,
  activeColor = "text-blue-500/50",
  className
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors p-1 hover:bg-muted-foreground/5 rounded-md",
        isActive ? activeColor : "text-muted-foreground/50",
        className
      )}
      type="button"
    >
      {icon}
    </button>
  );
};