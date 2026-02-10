import { JSX, useEffect, useMemo, useState } from "react";
import {
  getDeployedChatModels,
  onDeployedModelsUpdated,
} from "@/lib/nosana/deployedModels";

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
  const [deployedModels, setDeployedModels] = useState<ModelItem[]>([]);

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

  useEffect(() => {
    const sync = () => {
      const items: ModelItem[] = getDeployedChatModels().map((m) => ({
        label: m.label,
        value: m.value,
      }));
      setDeployedModels(items);
    };

    sync();
    return onDeployedModelsUpdated(sync);
  }, []);

  const groups = useMemo(
    () => [
      ...(deployedModels.length > 0
        ? [
            {
              label: "Deployed Models",
              models: deployedModels,
            },
          ]
        : []),
      {
        label: "Available Models",
        models: localModels,
      },
    ],
    [deployedModels, localModels],
  );

  const filteredGroups: ModelGroup[] = useMemo(() => {
    return groups;
  }, [groups]);

  return filteredGroups;
};
