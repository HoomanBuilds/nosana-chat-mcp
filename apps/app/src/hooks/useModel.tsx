import { JSX, useEffect, useMemo, useState } from "react";

export interface ModelItem {
  label: string;
  value: string;
  icon?: JSX.Element;
  disabled?: boolean;
}

export interface ModelGroup {
  label: string;
  models: ModelItem[];
}

export const useModelGroups = () => {
  const [localModels, setLocalModels] = useState<ModelItem[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/v1/models", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch models: ${res.status}`);
        }
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const items: ModelItem[] = json.data.map((m: any) => ({
            label: m.id,
            value: m.id,
          }));
          setLocalModels(items);
        }
      } catch (err) {
        console.error("Failed to fetch models from endpoint:", err);
      }
    };
    fetchModels();
  }, []);

  const groups = useMemo(
    () => [
      {
        label: "Available Models",
        models: localModels,
      },
    ],
    [localModels],
  );

  const filteredGroups: ModelGroup[] = useMemo(() => {
    return groups;
  }, [groups]);

  return filteredGroups;
};
