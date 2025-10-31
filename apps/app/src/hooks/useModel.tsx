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
  const [geminiKeyExists, setGeminiKeyExists] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setGeminiKeyExists(!!localStorage.getItem("geminiApiKey"));
    }
  }, []);


  const groups = useMemo(
    () => [
      {
        label: "Models",
        models: [
          { label: "Qwen3 4B", value: "self/qwen3:4b" },
          { label: "DeepSeek-R1 7B", value: "self/deepseek-r1:7b" },
          { label: "Qwen3 0.6B", value: "self/qwen3:0.6b" },
          { label: "LLaMA 3.8B", value: "self/llama-3.8b" },
          { label: "Mistral 7B", value: "self/mistral-7b", disabled: true },
        ],
      },
      {
        label: "Popular Models",
        models: [
          { label: "gemini-2.0-flash", value: "gemini/gemini-2.0-flash" },
          { label: "gemini-2.5-flash", value: "gemini/gemini-2.5-flash" },
          { label: "gemini-2.5-pro", value: "gemini/gemini-2.5-pro", disabled: !geminiKeyExists },
          { label: "gemini-2.0-flash-lite", value: "gemini/gemini-2.0-flash-lite"},
        ],
      },
    ],
    [geminiKeyExists]
  );

  const filteredGroups: ModelGroup[] = useMemo(() => {
    return groups.map(group => ({
      ...group,
      models: group.models,
    }));
  }, [groups]);

  return filteredGroups;
};
