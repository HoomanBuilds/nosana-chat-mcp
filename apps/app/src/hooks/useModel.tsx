import { JSX, useMemo } from "react";
import useSWR from "swr";

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

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
});

export const useModelGroups = ({ onlyModel }: UseModelGroupsOptions = {}) => {
  const { data, isLoading: isSwrLoading } = useSWR(
    onlyModel ? null : "/api/v1/models",
    fetcher,
    { revalidateOnFocus: false }
  );

  const localModels: ModelItem[] = useMemo(() => {
    if (onlyModel) {
      return [
        {
          label: onlyModel,
          value: onlyModel,
        },
      ];
    }

    if (data?.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => ({
        label: m.id,
        value: m.id,
      }));
    }

    return [];
  }, [onlyModel, data]);

  const isLoading = onlyModel ? false : isSwrLoading;

  const groups: ModelGroup[] = useMemo(
    () => [
      {
        label: "Available Models",
        models: localModels,
      },
    ],
    [localModels],
  );

  return { groups, isLoading };
};
