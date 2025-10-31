import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { ping } from "@/lib/utils";
import { FileText, Key, Settings, Sliders } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import QUICK_TEMPLATES from "@/lib/utils/QuickPromptTemplates";

interface Tab {
  name: string;
  logo: React.ReactNode;
}

interface ApiKeyFieldProps {
  label: string;
  storageKey: string;
  placeholder: string;
  pingModel: string;
}


const TABS: Tab[] = [
  { name: "Custom Prompt", logo: <FileText size={20} /> },
  { name: "Custom Configs", logo: <Settings size={20} /> },
  { name: "Additional Setting", logo: <Sliders size={20} /> },
  ...(process.env.NODE_ENV !== "production" ? [{ name: "API Keys", logo: <Key size={20} /> }] : []),
];

const CustomPromptTab = () => {
  const { customPrompt, setCustomPrompt, handleSaveCustomPrompt } = useSettings();

  return (
    <div className="flex flex-col gap-4 mx-auto">
      <label className="font-medium text-sm">Custom Prompt:</label>
      <textarea
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        className="border border-muted-foreground/20 bg-background/30 h-52 rounded-lg p-3 w-full resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-colors"
        placeholder="Enter your custom prompt here..."
      />
      <button
        onClick={handleSaveCustomPrompt}
        className="bg-green-500 text-white py-2 rounded w-full hover:bg-green-600 cursor-pointer transition-colors font-medium"
      >
        Save Prompt
      </button>

      <div className="mt-2">
        <label className="font-medium text-sm">Quick Prompt Templates:</label>
        <div className="flex flex-wrap gap-2 mt-3">
          {QUICK_TEMPLATES.map((template) => (
            <button
              key={template.label}
              onClick={() => setCustomPrompt(template.prompt)}
              className="bg-muted-foreground/5 hover:bg-muted-foreground/15 cursor-pointer px-3 py-2 rounded-lg text-sm transition-colors border border-transparent hover:border-muted-foreground/20"
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const SliderControl = ({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 0.01,
  valueLabels = []
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  valueLabels?: string[];
}) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={label.replace(/\s+/g, '-').toLowerCase()} className="text-sm font-medium">
      {label}: {value}
    </Label>
    <div className="flex justify-between text-xs text-muted-foreground">
      {valueLabels.length === 3 ? (
        <>
          <span>{valueLabels[0]}</span>
          <span>{valueLabels[1]}</span>
          <span>{valueLabels[2]}</span>
        </>
      ) : (
        <>
          <span>{min}</span>
          <span>{(min + max) / 2}</span>
          <span>{max}</span>
        </>
      )}
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(val) => onValueChange(val[0])}
      className="my-2"
    />
  </div>
);

const CustomConfigsTab = () => {
  const {
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
    handleSaveAIConfig,
  } = useSettings();

  return (
    <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
      <SliderControl
        label="Temperature"
        value={temperature}
        onValueChange={setTemperature}
        min={0}
        max={1}
        valueLabels={["0", "0.5", "1"]}
      />

      <SliderControl
        label="Max Tokens"
        value={maxTokens}
        onValueChange={setMaxTokens}
        min={1}
        max={4000}
        step={1}
        valueLabels={["1", "2000", "4000"]}
      />

      <SliderControl
        label="Top P"
        value={topP}
        onValueChange={setTopP}
        min={0}
        max={1}
        valueLabels={["0", "0.5", "1"]}
      />

      <SliderControl
        label="Presence Penalty"
        value={presencePenalty}
        onValueChange={setPresencePenalty}
        min={-2}
        max={2}
        valueLabels={["-2", "0", "2"]}
      />

      <SliderControl
        label="Frequency Penalty"
        value={frequencyPenalty}
        onValueChange={setFrequencyPenalty}
        min={-2}
        max={2}
        valueLabels={["-2", "0", "2"]}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="stop-sequences" className="text-sm font-medium">
          Stop Sequences (comma separated):
        </Label>
        <Input
          id="stop-sequences"
          value={stopSequences}
          onChange={(e) => setStopSequences(e.target.value)}
          placeholder="e.g., \n, END, STOP"
          className="mt-1"
        />
      </div>

      <div className="border-t border-muted-foreground/20 pt-6">
        <h3 className="text-lg font-semibold mb-4">Context Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="absolute-max-tokens" className="text-sm font-medium">
              Absolute Max Tokens
            </Label>
            <Input
              id="absolute-max-tokens"
              type="number"
              min={1}
              max={10000}
              value={context?.absoluteMaxTokens ?? 4000}
              onChange={(e) => {
                const val = Math.min(Math.max(Number(e.target.value), 1), 10000);
                setContext(prev => ({ ...prev, absoluteMaxTokens: val }));
              }}
            />
            <p className="text-xs text-muted-foreground">Maximum: 10,000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prev-chat-limit" className="text-sm font-medium">
              Minimum Previous Chat
            </Label>
            <Input
              id="prev-chat-limit"
              type="number"
              min={1}
              max={30}
              value={context?.prevChatLimit ?? 6}
              onChange={(e) => {
                const val = Math.min(Math.max(Number(e.target.value), 1), 30);
                setContext(prev => ({ ...prev, prevChatLimit: val }));
              }}
            />
            <p className="text-xs text-muted-foreground">Minimum messages to include (1-30)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-context-tokens" className="text-sm font-medium">
              Max Context Tokens
            </Label>
            <Input
              id="max-context-tokens"
              type="number"
              min={1}
              max={10000}
              value={context?.maxContextTokens ?? 3000}
              onChange={(e) => {
                const val = Math.min(Math.max(Number(e.target.value), 1), 10000);
                setContext(prev => ({ ...prev, maxContextTokens: val }));
              }}
            />
            <p className="text-xs text-muted-foreground">Maximum: 10,000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="truncate-from" className="text-sm font-medium">
              Truncate From
            </Label>
            <div className="flex items-center justify-between bg-background/30 rounded-lg p-2  px-3 border border-muted-foreground/20">
              <span className="text-sm">{context?.truncateFrom === 'end' ? "End" : "Start"}</span>
              <Switch
                id="truncate-from"
                checked={context?.truncateFrom === 'end'}
                onCheckedChange={() => {
                  setContext(prev => ({
                    ...prev,
                    truncateFrom: prev?.truncateFrom === 'end' ? 'start' : 'end'
                  }));
                }}
                className="cursor-pointer data-[state=unchecked]:bg-muted-foreground/30 data-[state=checked]:bg-green-500"
              />
            </div>
            <p className="text-xs text-muted-foreground">Where to truncate if context exceeds max</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSaveAIConfig}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 cursor-pointer transition-colors font-medium mt-2"
      >
        Save Configuration
      </button>
    </div>
  );
};

const AdditionalSettingsTab = () => {
  const { localConfig, setLocalConfig, handleSaveLocalConfig, DEFAULT_LOCAL_SETTINGS } = useSettings();

  const toggleSetting = (key: string, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    handleSaveLocalConfig(newConfig);
  };

  const settings = [
    {
      id: "followUp",
      label: "Want follow up?",
      checked: localStorage.getItem("geminiApiKey")
        ? localConfig.followUp ?? DEFAULT_LOCAL_SETTINGS.follow_up
        : false,
      disabled: !localStorage.getItem("geminiApiKey") && process.env.NODE_ENV !== "development"
    },
    {
      id: "showErrorMessages",
      label: "Show error messages?",
      checked: localConfig.showErrorMessages ?? DEFAULT_LOCAL_SETTINGS.show_error_messages
    },
    {
      id: "appearance",
      label: `Dark Mode (${localConfig.appearance === "dark" ? "On" : "Off"})`,
      checked: localConfig.appearance === "dark"
    }
  ];

  return (
    <div className="space-y-2 py-2">
      {settings.map((setting) => (
        <div key={setting.id} className="flex w-full items-center justify-between p-3 bg-background/30 rounded-lg border border-muted-foreground/20">
          <Label htmlFor={setting.id} className="text-sm font-medium cursor-pointer flex-1">
            {setting.label}
          </Label>
          <Switch
            id={setting.id}
            checked={setting.checked}
            disabled={setting.disabled}
            onCheckedChange={(checked) => {
              if (setting.id === "appearance") {
                const newAppearance = checked ? "dark" : "light";
                toggleSetting("appearance", newAppearance);
              } else {
                toggleSetting(setting.id, checked);
              }
            }}
            className="cursor-pointer data-[state=unchecked]:bg-muted-foreground/30 data-[state=checked]:bg-green-500"
          />
        </div>
      ))}
    </div>
  );
};

const ApiKeysTab = () => (
  <div className="space-y-4 py-2">
    <ApiKeyField
      label="Tavily"
      storageKey="TavilyApiKey"
      placeholder="Enter your Tavily API key"
      pingModel="tavilydefault"
    />
    <ApiKeyField
      label="Gemini"
      storageKey="geminiApiKey"
      placeholder="Enter your Gemini API key"
      pingModel="gemini-2.0-flash"
    />
  </div>
);

const ApiKeyField = ({ label, storageKey, placeholder, pingModel }: ApiKeyFieldProps) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setValue(localStorage.getItem(storageKey) || "");
    }
  }, [storageKey]);

  const handleSave = async () => {
    const isValid = await ping({
      provider: label,
      apiKey: value,
      modelName: pingModel
    });

    if (isValid) {
      localStorage.setItem(storageKey, value);
      alert("API key saved successfully!");
    } else {
      alert("Invalid API key. Please check and try again.");
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-background/30 rounded-lg border border-muted-foreground/20">
      <Label htmlFor={storageKey} className="text-sm font-medium">
        {label} API Key
      </Label>
      <div className="flex gap-2 items-center">
        <Input
          id={storageKey}
          type="password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
        />
        <button
          onClick={handleSave}
          className="px-4 py-2 cursor-pointer bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium whitespace-nowrap"
        >
          Save
        </button>
      </div>
    </div>
  );
};

const TabButton = ({ tab, isActive, onClick }: { tab: Tab; isActive: boolean; onClick: () => void }) => (
  <button
    className={`flex-1 sm:flex-initial flex justify-center items-center font-medium cursor-pointer py-3 px-4 rounded-lg transition-colors ${isActive
      ? "bg-muted-foreground/5 text-foreground"
      : "text-muted-foreground hover:bg-muted-foreground/5"
      }`}
    onClick={onClick}
  >
    <span className="sm:hidden">{tab.logo}</span>
    <span className="hidden sm:inline text-sm">{tab.name}</span>
  </button>
);

function  SettingPopover({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { activeTab, setActiveTab } = useSettings();

  const renderActiveTab = () => {
    switch (activeTab) {
      case "Custom Prompt":
        return <CustomPromptTab />;
      case "Custom Configs":
        return <CustomConfigsTab />;
      case "Additional Setting":
        return <AdditionalSettingsTab />;
      case "API Keys":
        return <ApiKeysTab />;
      default:
        return <CustomPromptTab />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="min-w-4/5 lg:min-w-3/5 h-[90vh] sm:h-[80vh] bg-muted/90 backdrop-blur-2xl p-0 flex flex-col sm:flex-row rounded-2xl overflow-hidden">
        <div className="sm:w-64 bg-muted/80 flex flex-row sm:flex-col p-4 gap-2 border-b sm:border-b-0 sm:border-r border-muted-foreground/5">
          {TABS.map((tab) => (
            <TabButton
              key={tab.name}
              tab={tab}
              isActive={activeTab === tab.name}
              onClick={() => setActiveTab(tab.name)}
            />
          ))}
        </div>

        <div className="flex-1 p-6 h-full overflow-auto">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold text-foreground">
              Settings
            </DialogTitle>
          </DialogHeader>

          <div>
            {renderActiveTab()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingPopover;

const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.3);
    border-radius: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--muted-foreground) / 0.5);
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = scrollbarStyles;
  document.head.append(style);
}