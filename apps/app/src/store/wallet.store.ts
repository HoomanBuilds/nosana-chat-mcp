"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WalletState {
  isPhantom: boolean;
  wallet: string | null;
  provider: any;
  isConnected: boolean;
  checkPhantom: () => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  verifyConnection: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      isPhantom: false,
      wallet: null,
      provider: null,
      isConnected: false,

      checkPhantom: () => {
        const provider = (window as any)?.solana;
        if (provider?.isPhantom) {
          set({ isPhantom: true, provider });

          provider.connect({ onlyIfTrusted: true })
            .then((resp: any) => {
              if (resp?.publicKey) {
                set({ wallet: resp.publicKey.toString(), isConnected: true });
              }
            })
            .catch(() => { });

          provider.removeAllListeners?.("connect");
          provider.removeAllListeners?.("disconnect");

          provider.on("connect", (pubKey: any) => {
            set({ wallet: pubKey.toString(), isConnected: true });
          });

          provider.on("disconnect", () => {
            set({ wallet: null, isConnected: false });
          });
        } else {
          set({ isPhantom: false, provider: null });
        }
      },

      connectWallet: async () => {
        const provider = (window as any)?.solana;
        if (!provider?.isPhantom) {
          window.open("https://phantom.app/", "_blank");
          throw new Error("Phantom Wallet not installed");
        }
        try {
          const resp = await provider.connect();
          if (resp?.publicKey) {
            set({ wallet: resp.publicKey.toString(), provider, isConnected: true });
          } else {
            throw new Error("No public key returned");
          }
        } catch (err) {
          console.warn("Wallet connection rejected:", err);
        }
      },

      disconnectWallet: async () => {
        const provider = get().provider;
        try {
          await provider?.disconnect();
        } catch { }
        set({ wallet: null, isConnected: false });
      },

      verifyConnection: () => {
        const provider = (window as any)?.solana;
        if (provider?.publicKey) {
          set({ wallet: provider.publicKey.toString(), isConnected: true });
        }
      },
    }),
    {
      name: "wallet-storage",
      partialize: (state) => ({
        isPhantom: state.isPhantom,
        wallet: state.wallet,
        isConnected: state.isConnected,
      }),
    }
  )
);
