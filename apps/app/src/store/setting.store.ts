import { create } from "zustand";

export interface LocalConfig {
  showErrorMessages: boolean;
  appearance: "light" | "dark";
  followUp: boolean;
}

interface SettingsState {
  templateOpen: boolean;
  settingsOpen: boolean;
  activeTab: string;
  mobileOpen: boolean;               
  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openTemplate: () => void;
  toggleTemplate: () => void;
  closeTemplate: () => void;
  setActiveTab: (tab: string) => void;
  toggleMobile: () => void;          
  openMobile: () => void;            
  closeMobile: () => void;           

  localConfig: LocalConfig;
  setLocalConfig: (config: Partial<LocalConfig>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settingsOpen: false,
  templateOpen: false,
  activeTab: "Custom Prompt",
  mobileOpen: false,                

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  
  toggleTemplate: () => set((state) => ({ templateOpen: !state.templateOpen })),
  openTemplate: () => set({ templateOpen: true }),
  closeTemplate: () => set({ templateOpen: false }),

  toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })), 
  openMobile: () => set({ mobileOpen: true }),                              
  closeMobile: () => set({ mobileOpen: false }),                            

  setActiveTab: (tab: string) => set({ activeTab: tab }),

  localConfig: { showErrorMessages: false, appearance: "dark", followUp: true },

  setLocalConfig: (config) =>
    set((state) => {
      const updated = { ...state.localConfig, ...config };
      if (typeof window !== "undefined") {
        localStorage.setItem("localConfig", JSON.stringify(updated));
      }
      return { localConfig: updated };
    }),
}));
