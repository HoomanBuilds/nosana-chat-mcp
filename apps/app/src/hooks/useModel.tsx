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

interface UseModelGroupsOptions {
  onlyModel?: string;
}

export const useModelGroups = ({ onlyModel }: UseModelGroupsOptions = {}) => {
  const [localModels, setLocalModels] = useState<ModelItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (onlyModel) {
      setLocalModels([
        {
          label: onlyModel,
          value: onlyModel,
        },
      ]);
      setIsLoading(false);
      return;
    }

    const fetchModels = async () => {
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };
    fetchModels();
  }, [onlyModel]);

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

  return { groups: filteredGroups, isLoading };
};
