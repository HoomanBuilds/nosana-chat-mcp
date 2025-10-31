"use client";
import { useWalletStore } from "@/store/wallet.store";
import { useEffect } from "react";
import { Button } from "./ui/button";
import { Ghost, PlugZap, Wallet } from "lucide-react";

export default function PhantomConnect({ className }: { className?: string }) {
  const { isPhantom, wallet, checkPhantom, connectWallet } = useWalletStore();

  useEffect(() => {
      checkPhantom();
  }, [checkPhantom]);

  if (!isPhantom)
    return (
      <Button
        asChild
        variant="outline"
        className={`opacity-60 cursor-not-allowed rounded-none`}
      >
        <span>
          <PlugZap className="mr-2 h-4 w-4" />
          Install Phantom
        </span>
      </Button>
    );

  if (wallet) return <Wallet className="text-green-500" onClick={()=> navigator.clipboard.writeText(wallet)}/>;

  return (
    <Button onClick={connectWallet} className={className}>
      <Ghost className="h-4 w-4" />
      connect Wallet
    </Button>
  );
}
