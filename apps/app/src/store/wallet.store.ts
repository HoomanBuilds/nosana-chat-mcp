"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthMode = 'wallet' | 'api_key' | 'none';

interface WalletState {
  // ── Auth mode ──
  authMode: AuthMode;

  // ── Wallet (Phantom) state ──
  isPhantom: boolean;
  wallet: string | null;
  provider: any;
  isConnected: boolean;

  // ── API key state ──
  nosanaApiKey: string | null;
  isApiKeyConnected: boolean;

  // ── Internal: tracks explicit user disconnect to prevent auto-reconnect ──
  _walletDisconnectedByUser: boolean;

  // ── Actions ──
  checkPhantom: () => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  verifyConnection: () => void;

  // ── API key actions ──
  setNosanaApiKey: (key: string) => void;
  clearNosanaApiKey: () => void;

  /** Returns the credential to send in Bearer header — wallet pubkey or API key */
  getCredential: () => string | null;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      authMode: 'none',
      isPhantom: false,
      wallet: null,
      provider: null,
      isConnected: false,
      nosanaApiKey: null,
      isApiKeyConnected: false,
      _walletDisconnectedByUser: false,

      checkPhantom: () => {
        const provider = (window as any)?.solana;
        if (provider?.isPhantom) {
          set({ isPhantom: true, provider });

          // Only auto-reconnect if the user didn't explicitly disconnect
          const wasDisconnected = get()._walletDisconnectedByUser;
          if (!wasDisconnected) {
            provider.connect({ onlyIfTrusted: true })
              .then((resp: any) => {
                if (resp?.publicKey) {
                  set({ wallet: resp.publicKey.toString(), isConnected: true, authMode: 'wallet' });
                }
              })
              .catch(() => { });
          }

          provider.removeAllListeners?.("connect");
          provider.removeAllListeners?.("disconnect");

          provider.on("connect", (pubKey: any) => {
            set({
              wallet: pubKey.toString(),
              isConnected: true,
              authMode: 'wallet',
              _walletDisconnectedByUser: false,
            });
          });

          provider.on("disconnect", () => {
            set({
              wallet: null,
              isConnected: false,
              authMode: get().isApiKeyConnected ? 'api_key' : 'none',
            });
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
            set({
              wallet: resp.publicKey.toString(),
              provider,
              isConnected: true,
              authMode: 'wallet',
              _walletDisconnectedByUser: false, // Clear the flag on explicit connect
            });
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
        set({
          wallet: null,
          isConnected: false,
          authMode: get().isApiKeyConnected ? 'api_key' : 'none',
          _walletDisconnectedByUser: true, // Mark as explicitly disconnected
        });
      },

      verifyConnection: () => {
        // Only verify if user didn't explicitly disconnect
        if (get()._walletDisconnectedByUser) return;
        const provider = (window as any)?.solana;
        if (provider?.publicKey) {
          set({ wallet: provider.publicKey.toString(), isConnected: true, authMode: 'wallet' });
        }
      },

      // ── API key methods ──

      setNosanaApiKey: (key: string) => {
        if (!key.startsWith('nos_')) {
          console.warn('Invalid Nosana API key format. Expected nos_xxx_...');
        }
        set({
          nosanaApiKey: key,
          isApiKeyConnected: true,
          // Only switch auth mode if wallet is not connected
          authMode: get().isConnected ? 'wallet' : 'api_key',
        });
      },

      clearNosanaApiKey: () => {
        set({
          nosanaApiKey: null,
          isApiKeyConnected: false,
          authMode: get().isConnected ? 'wallet' : 'none',
        });
      },

      getCredential: () => {
        const state = get();
        if (state.authMode === 'wallet' && state.wallet) return state.wallet;
        if (state.authMode === 'api_key' && state.nosanaApiKey) return state.nosanaApiKey;
        // Fallback: return whichever is available
        return state.wallet || state.nosanaApiKey || null;
      },
    }),
    {
      name: "wallet-storage",
      partialize: (state) => ({
        // Only persist API key + disconnect flag
        // Wallet connection is re-derived from Phantom on each page load
        nosanaApiKey: state.nosanaApiKey,
        isApiKeyConnected: state.isApiKeyConnected,
        _walletDisconnectedByUser: state._walletDisconnectedByUser,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, set authMode based on restored API key state
        if (state?.isApiKeyConnected && state?.nosanaApiKey) {
          state.authMode = 'api_key';
        }
      },
    }
  )
);
