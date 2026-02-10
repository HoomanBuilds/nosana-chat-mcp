"use client";
import { useWalletStore } from "@/store/wallet.store";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Ghost,
  Key,
  Wallet,
  PlugZap,
  Check,
  X,
  LogOut,
  Copy,
  ExternalLink,
} from "lucide-react";

export default function PhantomConnect({ className }: { className?: string }) {
  const {
    isPhantom,
    wallet,
    authMode,
    nosanaApiKey,
    isApiKeyConnected,
    isConnected,
    checkPhantom,
    connectWallet,
    disconnectWallet,
    setNosanaApiKey,
    clearNosanaApiKey,
  } = useWalletStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkPhantom();
  }, [checkPhantom]);

  const handleApiKeySave = () => {
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) {
      setApiKeyError("Please enter your API key");
      return;
    }
    if (!trimmed.startsWith("nos_")) {
      setApiKeyError("Invalid format — Nosana API keys start with nos_");
      return;
    }
    setNosanaApiKey(trimmed);
    setApiKeyError("");
    setApiKeySaved(true);
    setApiKeyDraft("");
    setTimeout(() => {
      setApiKeySaved(false);
      setDialogOpen(false);
    }, 1200);
  };

  const handleWalletConnect = async () => {
    try {
      await connectWallet();
      setDialogOpen(false);
    } catch {
      // user rejected or Phantom not installed
    }
  };

  const copyWallet = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // ── Connected indicator (compact) ──
  if (isConnected || isApiKeyConnected) {
    return (
      <div className="flex items-center gap-1.5">
        {/* Main connection icon */}
        {authMode === "wallet" && wallet ? (
          <button
            onClick={copyWallet}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted-foreground/10 transition-colors text-xs"
            title={copied ? "Copied!" : `Click to copy: ${wallet}`}
          >
            <Wallet className="h-3.5 w-3.5 text-green-500" />
            <span className="text-muted-foreground hidden sm:inline">
              {copied ? "Copied!" : `${wallet.slice(0, 4)}...${wallet.slice(-4)}`}
            </span>
          </button>
        ) : authMode === "api_key" && isApiKeyConnected ? (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted-foreground/10 transition-colors text-xs"
            onClick={() => setDialogOpen(true)}
            title="Connected via API Key"
          >
            <Key className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-muted-foreground hidden sm:inline">API Key</span>
          </button>
        ) : null}

        {/* Manage button */}
        <button
          onClick={() => setDialogOpen(true)}
          className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground/60 transition-colors"
          title="Manage connection"
        >
          <PlugZap className="h-3 w-3" />
        </button>

        {/* Connection management dialog */}
        <ConnectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          isPhantom={isPhantom}
          wallet={wallet}
          isConnected={isConnected}
          isApiKeyConnected={isApiKeyConnected}
          nosanaApiKey={nosanaApiKey}
          authMode={authMode}
          apiKeyDraft={apiKeyDraft}
          setApiKeyDraft={setApiKeyDraft}
          apiKeyError={apiKeyError}
          setApiKeyError={setApiKeyError}
          apiKeySaved={apiKeySaved}
          onWalletConnect={handleWalletConnect}
          onWalletDisconnect={disconnectWallet}
          onApiKeySave={handleApiKeySave}
          onApiKeyClear={clearNosanaApiKey}
        />
      </div>
    );
  }

  // ── Not connected — show "Connect" button ──
  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        className={className || ""}
        size="sm"
        variant="outline"
      >
        <PlugZap className="h-3.5 w-3.5 mr-1.5" />
        Connect
      </Button>

      <ConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isPhantom={isPhantom}
        wallet={wallet}
        isConnected={isConnected}
        isApiKeyConnected={isApiKeyConnected}
        nosanaApiKey={nosanaApiKey}
        authMode={authMode}
        apiKeyDraft={apiKeyDraft}
        setApiKeyDraft={setApiKeyDraft}
        apiKeyError={apiKeyError}
        setApiKeyError={setApiKeyError}
        apiKeySaved={apiKeySaved}
        onWalletConnect={handleWalletConnect}
        onWalletDisconnect={disconnectWallet}
        onApiKeySave={handleApiKeySave}
        onApiKeyClear={clearNosanaApiKey}
      />
    </>
  );
}

// ── Connect Dialog ──────────────────────────────────────────────────────

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPhantom: boolean;
  wallet: string | null;
  isConnected: boolean;
  isApiKeyConnected: boolean;
  nosanaApiKey: string | null;
  authMode: string;
  apiKeyDraft: string;
  setApiKeyDraft: (v: string) => void;
  apiKeyError: string;
  setApiKeyError: (v: string) => void;
  apiKeySaved: boolean;
  onWalletConnect: () => void;
  onWalletDisconnect: () => void;
  onApiKeySave: () => void;
  onApiKeyClear: () => void;
}

function ConnectDialog({
  open,
  onOpenChange,
  isPhantom,
  wallet,
  isConnected,
  isApiKeyConnected,
  nosanaApiKey,
  authMode,
  apiKeyDraft,
  setApiKeyDraft,
  apiKeyError,
  setApiKeyError,
  apiKeySaved,
  onWalletConnect,
  onWalletDisconnect,
  onApiKeySave,
  onApiKeyClear,
}: ConnectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            Connect to Nosana
          </DialogTitle>
          <DialogDescription>
            Choose how to connect — via a Solana wallet or a Nosana API key.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* ── Option 1: Phantom Wallet ── */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ghost className="h-5 w-5 text-purple-400" />
                <span className="font-medium text-sm">Phantom Wallet</span>
              </div>
              {isConnected && wallet && (
                <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                  Connected
                </span>
              )}
            </div>

            {isConnected && wallet ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                    {wallet}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(wallet);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy address"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <Button
                  onClick={onWalletDisconnect}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  <LogOut className="h-3 w-3 mr-1.5" />
                  Disconnect Wallet
                </Button>
              </div>
            ) : isPhantom ? (
              <Button
                onClick={onWalletConnect}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                size="sm"
              >
                <Ghost className="h-3.5 w-3.5 mr-1.5" />
                Connect Phantom
              </Button>
            ) : (
              <Button
                onClick={() => window.open("https://phantom.app/", "_blank")}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Install Phantom Wallet
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground/60">
              Uses on-chain SOL + NOS tokens for payments.
            </p>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">or</span>
            <div className="flex-1 border-t" />
          </div>

          {/* ── Option 2: Nosana API Key ── */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-blue-400" />
                <span className="font-medium text-sm">Nosana API Key</span>
              </div>
              {isApiKeyConnected && nosanaApiKey && (
                <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                  Saved
                </span>
              )}
            </div>

            {isApiKeyConnected && nosanaApiKey ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                    {nosanaApiKey.slice(0, 12)}{"•".repeat(20)}
                  </span>
                </div>
                <Button
                  onClick={onApiKeyClear}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  <X className="h-3 w-3 mr-1.5" />
                  Remove API Key
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="nos_xxx_..."
                  value={apiKeyDraft}
                  onChange={(e) => {
                    setApiKeyDraft(e.target.value);
                    setApiKeyError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && onApiKeySave()}
                  className="font-mono text-sm"
                />
                {apiKeyError && (
                  <p className="text-xs text-red-400">{apiKeyError}</p>
                )}
                {apiKeySaved && (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <Check className="h-3 w-3" /> API key saved!
                  </p>
                )}
                <Button
                  onClick={onApiKeySave}
                  disabled={!apiKeyDraft.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                  size="sm"
                >
                  <Key className="h-3.5 w-3.5 mr-1.5" />
                  Save API Key
                </Button>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground/60">
              Uses Nosana credits for payments.{" "}
              <a
                href="https://deploy.nosana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Get your key →
              </a>
            </p>
          </div>

          {/* ── Active mode indicator ── */}
          {(isConnected || isApiKeyConnected) && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground text-center">
              Active mode:{" "}
              <span className="font-medium text-foreground">
                {authMode === "wallet" ? "🟢 Wallet (On-chain)" : authMode === "api_key" ? "🔵 API Key (Credits)" : "None"}
              </span>
              {isConnected && isApiKeyConnected && (
                <span className="block text-[11px] mt-0.5 text-muted-foreground/60">
                  Both connected — wallet takes priority
                </span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
