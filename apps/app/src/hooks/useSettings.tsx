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


    const [temperature, setTemperature] = useState(DEFAULT_AI_CONFIG.temperature);
    const [maxTokens, setMaxTokens] = useState(DEFAULT_AI_CONFIG.max_tokens);
    const [topP, setTopP] = useState(DEFAULT_AI_CONFIG.top_p);
    const [presencePenalty, setPresencePenalty] = useState(DEFAULT_AI_CONFIG.presence_penalty);
    const [frequencyPenalty, setFrequencyPenalty] = useState(DEFAULT_AI_CONFIG.frequency_penalty);
    const [stopSequences, setStopSequences] = useState(DEFAULT_AI_CONFIG.stop.join(", "));
    const [context, setContext] = useState<AIContext>({ ...DEFAULT_AI_CONFIG.context });

    useEffect(() => {
        const saved = localStorage.getItem("customAIConfig");
        if (saved) {
            const parsed: AIConfig = JSON.parse(saved);
            setTemperature(parsed.temperature);
            setMaxTokens(parsed.max_tokens);
            setTopP(parsed.top_p);
            setPresencePenalty(parsed.presence_penalty);
            setFrequencyPenalty(parsed.frequency_penalty);
            setStopSequences(parsed.stop.join(", "));
            setContext(parsed.context);
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
            temperature,
            max_tokens: maxTokens,
            top_p: topP,
            presence_penalty: presencePenalty,
            frequency_penalty: frequencyPenalty,
            stop: stopSequences.split(",").map((s : string) => s.trim()).filter(Boolean),
            context,
        };
        localStorage.setItem("customAIConfig", JSON.stringify(config));
    }, [temperature, maxTokens, topP, presencePenalty, frequencyPenalty, stopSequences, context]);

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
        temperature,
        setTemperature,
        maxTokens,
        setMaxTokens,
        topP,
        setTopP,
        presencePenalty,
        setPresencePenalty,
        frequencyPenalty,
        setFrequencyPenalty,
        stopSequences,
        setStopSequences,
        context,
        setContext,
        localConfig,
        setLocalConfig,
        handleSavePrompt,
        handleSaveAIConfig,
        handleSaveLocalConfig,
        handleSaveCustomPrompt,
        DEFAULT_LOCAL_SETTINGS
    };
}
