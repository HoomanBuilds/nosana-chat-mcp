import { useState, useEffect, useCallback } from "react";
import { LocalConfig, useSettingsStore } from "@/store/setting.store";
import { AIConfig, AIContext, DEFAULT_AI_CONFIG, DEFAULT_LOCAL_SETTINGS } from "@/lib/constants";


export function useSettings() {
    const { activeTab, setActiveTab, localConfig, setLocalConfig } = useSettingsStore();
    const [customPrompt, setCustomPrompt] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("customPrompt");
        if (saved) setCustomPrompt(saved);
    }, []);


    const [aiConfig, setAiConfig] = useState<AIConfig>(() => ({
        temperature: DEFAULT_AI_CONFIG.temperature,
        max_tokens: DEFAULT_AI_CONFIG.max_tokens,
        top_p: DEFAULT_AI_CONFIG.top_p,
        presence_penalty: DEFAULT_AI_CONFIG.presence_penalty,
        frequency_penalty: DEFAULT_AI_CONFIG.frequency_penalty,
        stop: DEFAULT_AI_CONFIG.stop,
        context: { ...DEFAULT_AI_CONFIG.context },
    }));
    const [stopSequences, setStopSequences] = useState(() => DEFAULT_AI_CONFIG.stop.join(", "));

    useEffect(() => {
        const saved = localStorage.getItem("customAIConfig");
        if (saved) {
            const parsed: AIConfig = JSON.parse(saved);
            setAiConfig(parsed);
            setStopSequences(parsed.stop.join(", "));
        }
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem("localConfig");
        if (saved) setLocalConfig(JSON.parse(saved));
        else {
            const defaultConfig: Partial<LocalConfig> = {
                showErrorMessages: DEFAULT_LOCAL_SETTINGS.show_error_messages,
                appearance: DEFAULT_LOCAL_SETTINGS.appearance,
                followUp: DEFAULT_LOCAL_SETTINGS.follow_up,
            };
            localStorage.setItem("localConfig", JSON.stringify(defaultConfig));
            setLocalConfig(defaultConfig);
        }

        if (!localStorage.getItem("customPrompt")) localStorage.setItem("customPrompt", "");
        if (!localStorage.getItem("customAIConfig")) localStorage.setItem("customAIConfig", JSON.stringify(DEFAULT_AI_CONFIG));
    }, [setLocalConfig]);

    const handleSavePrompt = useCallback(() => {
        localStorage.setItem("customPrompt", customPrompt);
    }, [customPrompt]);

    const handleSaveAIConfig = useCallback(() => {
        const config: AIConfig = {
            ...aiConfig,
            stop: stopSequences.split(",").map((s: string) => s.trim()).filter(Boolean),
        };
        localStorage.setItem("customAIConfig", JSON.stringify(config));
        setAiConfig(config);
    }, [aiConfig, stopSequences]);

    const handleSaveLocalConfig = useCallback((configUpdate: Partial<LocalConfig>) => {
        const updated: Partial<LocalConfig> = {
            ...localConfig,
            ...configUpdate,
        };
        localStorage.setItem("localConfig", JSON.stringify(updated));
        setLocalConfig(updated);
    }, [localConfig, setLocalConfig]);


    const handleSaveCustomPrompt = () => {
        localStorage.setItem("customPrompt", customPrompt);
        alert("Custom prompt saved!");
    };

    return {
        activeTab,
        setActiveTab,
        customPrompt,
        setCustomPrompt,
        context: aiConfig.context,
        setContext: (c: AIContext) => setAiConfig(prev => ({ ...prev, context: c })),
        temperature: aiConfig.temperature,
        setTemperature: (t: number) => setAiConfig(prev => ({ ...prev, temperature: t })),
        maxTokens: aiConfig.max_tokens,
        setMaxTokens: (m: number) => setAiConfig(prev => ({ ...prev, max_tokens: m })),
        topP: aiConfig.top_p,
        setTopP: (p: number) => setAiConfig(prev => ({ ...prev, top_p: p })),
        presencePenalty: aiConfig.presence_penalty,
        setPresencePenalty: (p: number) => setAiConfig(prev => ({ ...prev, presence_penalty: p })),
        frequencyPenalty: aiConfig.frequency_penalty,
        setFrequencyPenalty: (f: number) => setAiConfig(prev => ({ ...prev, frequency_penalty: f })),
        stopSequences,
        setStopSequences,
        localConfig,
        setLocalConfig,
        handleSavePrompt,
        handleSaveAIConfig,
        handleSaveLocalConfig,
        handleSaveCustomPrompt,
        DEFAULT_LOCAL_SETTINGS
    };
}
