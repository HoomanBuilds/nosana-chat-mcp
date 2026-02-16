"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthMode = "wallet" | "api_key" | "none";

interface WalletState {
  // ── Auth mode ──
  authMode: AuthMode;

  // ── Wallet (Phantom) state ──
  isPhantom: boolean;
  wallet: string | null;
  provider: Window["solana"];
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
      authMode: "none",
      isPhantom: false,
      wallet: null,
      provider: null,
      isConnected: false,
      nosanaApiKey: null,
      isApiKeyConnected: false,
      _walletDisconnectedByUser: false,

      checkPhantom: () => {
        const provider = window.solana;
        if (provider?.isPhantom) {
          set({ isPhantom: true, provider });

          // Only auto-reconnect if the user didn't explicitly disconnect
          const wasDisconnected = get()._walletDisconnectedByUser;
          if (!wasDisconnected) {
            provider
              .connect({ onlyIfTrusted: true })
              .then((resp) => {
                if (resp?.publicKey) {
                  set({
                    wallet: resp.publicKey.toString(),
                    isConnected: true,
                    authMode: "wallet",
                  });
                }
              })
              .catch((err: unknown) => {
                // Silent fail for auto-connect - user hasn't explicitly requested connection
                if (process.env.NODE_ENV === "development") {
                  // eslint-disable-next-line no-console
                  console.debug("Auto-connect failed:", err);
                }
              });
          }

          provider.removeAllListeners?.("connect");
          provider.removeAllListeners?.("disconnect");

          provider.on("connect", (pubKey: unknown) => {
            const pk = pubKey as { toString(): string };
            set({
              wallet: pk.toString(),
              isConnected: true,
              authMode: "wallet",
              _walletDisconnectedByUser: false,
            });
          });

          provider.on("disconnect", () => {
            set({
              wallet: null,
              isConnected: false,
              authMode: get().isApiKeyConnected ? "api_key" : "none",
            });
          });
        } else {
          set({ isPhantom: false, provider: null });
        }
      },

      connectWallet: async () => {
        const provider = window.solana;
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
              authMode: "wallet",
              _walletDisconnectedByUser: false,
            });
          } else {
            throw new Error("No public key returned");
          }
        } catch (err) {
          // Re-throw to let caller handle the error
          throw err;
        }
      },

      disconnectWallet: async () => {
        const provider = get().provider;
        try {
          await provider?.disconnect();
        } catch (err: unknown) {
          // Wallet might already be disconnected, which is fine
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.debug(
              "Disconnect error (may be already disconnected):",
              err,
            );
          }
        }
        set({
          wallet: null,
          isConnected: false,
          authMode: get().isApiKeyConnected ? "api_key" : "none",
          _walletDisconnectedByUser: true,
        });
      },

      verifyConnection: () => {
        // Only verify if user didn't explicitly disconnect
        if (get()._walletDisconnectedByUser) return;
        const provider = window.solana;
        if (provider?.publicKey) {
          set({
            wallet: provider.publicKey.toString(),
            isConnected: true,
            authMode: "wallet",
          });
        }
      },

      // ── API key methods ──

      setNosanaApiKey: (key: string) => {
        if (!key.startsWith("nos_") && process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.debug(
            "Warning: Invalid Nosana API key format. Expected nos_xxx_...",
          );
        }
        set({
          nosanaApiKey: key,
          isApiKeyConnected: true,
          authMode: get().isConnected ? "wallet" : "api_key",
        });
      },

      clearNosanaApiKey: () => {
        set({
          nosanaApiKey: null,
          isApiKeyConnected: false,
          authMode: get().isConnected ? "wallet" : "none",
        });
      },

      getCredential: () => {
        const state = get();
        if (state.authMode === "wallet" && state.wallet) return state.wallet;
        if (state.authMode === "api_key" && state.nosanaApiKey)
          return state.nosanaApiKey;
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
          state.authMode = "api_key";
        }
      },
    },
  ),
);
