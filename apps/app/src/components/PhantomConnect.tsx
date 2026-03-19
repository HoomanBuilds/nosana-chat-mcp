"use client";
import { useWalletStore } from "@/store/wallet.store";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
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

export default function PhantomConnect({
  className,
  compactMobile = false,
}: {
  className?: string;
  compactMobile?: boolean;
}) {
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
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);

  useEffect(() => {
    checkPhantom();
  }, [checkPhantom]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsMobileBrowser(/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent));
  }, []);

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
    if (isConnected) {
      disconnectWallet().catch(() => undefined);
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
      if (isApiKeyConnected) {
        clearNosanaApiKey();
      }
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
      <div className="flex max-w-full flex-wrap items-center gap-1.5">
        {/* Main connection icon */}
        {authMode === "wallet" && wallet ? (
          <button
            onClick={compactMobile ? () => setDialogOpen(true) : copyWallet}
            type="button"
            className={cn(
              "flex min-w-0 max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted-foreground/10",
              compactMobile && "h-8 shrink-0 px-2",
            )}
            title={
              compactMobile
                ? "Manage wallet connection"
                : copied
                  ? "Copied!"
                  : `Click to copy: ${wallet}`
            }
          >
            <Wallet className="h-3.5 w-3.5 text-green-500" />
            <span
              className={cn(
                "max-w-[7.5rem] truncate text-muted-foreground sm:max-w-none",
                compactMobile && "hidden sm:inline",
              )}
            >
              {copied ? "Copied!" : `${wallet.slice(0, 4)}...${wallet.slice(-4)}`}
            </span>
          </button>
        ) : authMode === "api_key" && isApiKeyConnected ? (
          <button
            type="button"
            className={cn(
              "flex min-w-0 max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted-foreground/10",
              compactMobile && "h-8 shrink-0 px-2",
            )}
            onClick={() => setDialogOpen(true)}
            title="Connected via API Key"
          >
            <Key className="h-3.5 w-3.5 text-blue-400" />
            <span
              className={cn(
                "truncate text-muted-foreground",
                compactMobile && "hidden sm:inline",
              )}
            >
              API Key
            </span>
          </button>
        ) : null}

        {/* Manage button */}
        {!compactMobile && (
          <button
            onClick={() => setDialogOpen(true)}
            type="button"
            className="rounded p-2 text-muted-foreground/60 transition-colors hover:bg-muted-foreground/10"
            title="Manage connection"
          >
            <PlugZap className="h-3 w-3" />
          </button>
        )}

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
          isMobileBrowser={isMobileBrowser}
        />
      </div>
    );
  }

  // ── Not connected — show "Connect" button ──
  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        className={cn(
          "h-9 max-w-full gap-1.5 px-3 text-xs sm:h-8 sm:text-sm",
          compactMobile && "h-8 shrink-0 px-2.5 sm:px-3",
          className,
        )}
        size="sm"
        variant="outline"
      >
        <PlugZap className="h-3.5 w-3.5 mr-1.5" />
        <span className={cn(compactMobile && "hidden sm:inline")}>Connect</span>
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
        isMobileBrowser={isMobileBrowser}
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
  isMobileBrowser: boolean;
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
  isMobileBrowser,
}: ConnectDialogProps) {
  const connectedMethod =
    authMode === "wallet" && isConnected
      ? "wallet"
      : authMode === "api_key" && isApiKeyConnected
        ? "api_key"
        : isConnected
          ? "wallet"
          : isApiKeyConnected
            ? "api_key"
            : isPhantom
              ? "wallet"
              : "api_key";
  const [selectedMethod, setSelectedMethod] = useState<"wallet" | "api_key">(
    connectedMethod,
  );

  useEffect(() => {
    if (open) {
      setSelectedMethod(connectedMethod);
    }
  }, [open, connectedMethod]);

  const hasLegacyDualConnection = isConnected && isApiKeyConnected;
  const isWalletSelected = selectedMethod === "wallet";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden rounded-3xl border-border/70 bg-background p-4 shadow-2xl sm:max-h-[90dvh] sm:max-w-[36rem] sm:p-6">
        <DialogHeader className="min-w-0 space-y-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <DialogTitle className="flex min-w-0 items-center gap-2 text-xl font-semibold sm:text-2xl">
                <PlugZap className="h-5 w-5 text-green-400" />
                Connect to Nosana
              </DialogTitle>
              <DialogDescription className="max-w-[34rem] text-sm leading-6 text-muted-foreground sm:text-base">
                Pick one payment method. Switching methods disconnects the other one so only one stays active at a time.
              </DialogDescription>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setSelectedMethod("wallet")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isWalletSelected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Ghost className="h-4 w-4 text-purple-400" />
              Wallet
            </button>
            <button
              type="button"
              onClick={() => setSelectedMethod("api_key")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                !isWalletSelected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Key className="h-4 w-4 text-blue-400" />
              API Key
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
          <div className="space-y-3 pb-1">
            {hasLegacyDualConnection && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Multiple credentials were found from an older session. Your current active method stays selected, and switching will remove the other one.
              </div>
            )}

            {isWalletSelected ? (
              <div className="min-w-0 space-y-4 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-background to-muted/20 p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      <Ghost className="h-5 w-5 text-purple-400" />
                      Phantom Wallet
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Uses on-chain SOL and NOS for payments.
                    </p>
                  </div>
                  <StatusBadge
                    active={isConnected && !!wallet}
                    label={isConnected && wallet ? "Connected" : "Not connected"}
                  />
                </div>

                {isConnected && wallet ? (
                  <div className="space-y-3">
                    <CredentialRow
                      icon={<Wallet className="h-4 w-4 text-green-400" />}
                      value={wallet}
                      onCopy={() => navigator.clipboard.writeText(wallet)}
                    />
                    <Button
                      onClick={onWalletDisconnect}
                      variant="outline"
                      className="h-11 w-full rounded-2xl text-sm whitespace-normal"
                    >
                      <LogOut className="h-4 w-4" />
                      Disconnect Wallet
                    </Button>
                  </div>
                ) : isPhantom ? (
                  <div className="space-y-3">
                    <Button
                      onClick={onWalletConnect}
                      className="h-11 w-full rounded-2xl bg-purple-600 text-white hover:bg-purple-500 whitespace-normal"
                    >
                      <Ghost className="h-4 w-4" />
                      {isApiKeyConnected
                        ? "Switch to Wallet"
                        : "Connect Phantom"}
                    </Button>
                    {isApiKeyConnected && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Switching will remove your current API key from this session.
                      </p>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={onWalletConnect}
                    variant="outline"
                    className="h-11 w-full rounded-2xl text-sm whitespace-normal"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {isMobileBrowser ? "Open in Phantom" : "Install Phantom Wallet"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="min-w-0 space-y-4 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-background to-muted/20 p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      <Key className="h-5 w-5 text-blue-400" />
                      Nosana API Key
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Uses Nosana credits instead of your wallet.
                    </p>
                  </div>
                  <StatusBadge
                    active={isApiKeyConnected && !!nosanaApiKey}
                    label={isApiKeyConnected && nosanaApiKey ? "Active" : "Not connected"}
                  />
                </div>

                {isApiKeyConnected && nosanaApiKey ? (
                  <div className="space-y-3">
                    <CredentialRow
                      icon={<Key className="h-4 w-4 text-blue-400" />}
                      value={`${nosanaApiKey.slice(0, 12)}${"•".repeat(16)}`}
                    />
                    <Button
                      onClick={onApiKeyClear}
                      variant="outline"
                      className="h-11 w-full rounded-2xl text-sm whitespace-normal"
                    >
                      <X className="h-4 w-4" />
                      Remove API Key
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      placeholder="nos_xxx_..."
                      value={apiKeyDraft}
                      onChange={(e) => {
                        setApiKeyDraft(e.target.value);
                        setApiKeyError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onApiKeySave();
                        }
                      }}
                      className="h-12 rounded-2xl border-border/70 bg-muted/40 font-mono text-sm"
                    />
                    {apiKeyError && (
                      <p className="text-xs text-red-400">{apiKeyError}</p>
                    )}
                    {apiKeySaved && (
                      <p className="flex items-center gap-1 text-xs text-green-500">
                        <Check className="h-3 w-3" />
                        API key saved
                      </p>
                    )}
                    <Button
                      onClick={onApiKeySave}
                      disabled={!apiKeyDraft.trim()}
                      className="h-11 w-full rounded-2xl bg-blue-600 text-white hover:bg-blue-500 whitespace-normal"
                    >
                      <Key className="h-4 w-4" />
                      {isConnected ? "Switch to API Key" : "Save API Key"}
                    </Button>
                    {isConnected && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Switching will disconnect your current wallet session.
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs leading-5 text-muted-foreground">
                  Need a key?{" "}
                  <a
                    href="https://deploy.nosana.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Get your key
                  </a>
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setSelectedMethod(isWalletSelected ? "api_key" : "wallet")
              }
              className="flex w-full items-center justify-between rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/35"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {isWalletSelected ? "Prefer credits instead?" : "Prefer wallet payments?"}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {isWalletSelected
                    ? "Switch to a Nosana API key"
                    : "Switch to Phantom Wallet"}
                </p>
              </div>
              {isWalletSelected ? (
                <Key className="h-4 w-4 text-blue-400" />
              ) : (
                <Ghost className="h-4 w-4 text-purple-400" />
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        active
          ? "bg-green-500/10 text-green-400"
          : "bg-muted/60 text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          active ? "bg-green-400" : "bg-muted-foreground/50",
        )}
      />
      {label}
    </span>
  );
}

function CredentialRow({
  icon,
  value,
  onCopy,
}: {
  icon: ReactNode;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-2xl bg-muted/60 px-3 py-3">
      <div className="shrink-0">{icon}</div>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground sm:text-sm">
        {value}
      </span>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Copy className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
