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
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors",
        isActive ? activeColor : "text-muted-foreground/50",
        className
      )}
    >
      {icon}
    </div>
  );
};