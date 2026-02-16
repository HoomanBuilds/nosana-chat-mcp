import { Client, Job } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import { useWalletStore } from "@/store/wallet.store";

const NOSANA_API_BASE = "https://dashboard.k8s.prd.nos.ci/api";

// ── Wallet mode ──

async function extendJobViaWallet(
  jobAddress: PublicKey | string,
  extraMinutes: number,
): Promise<{ txSig: string; result: { result: string } }> {
  const { wallet, provider } = useWalletStore.getState();
  if (!provider || !wallet) throw new Error("Wallet not connected");

  // Type assertion needed because Wallet interface expects Keypair for payer,
  // but browser wallets like Phantom don't expose private keys
  const signer = {
    publicKey: provider.publicKey,
    signTransaction: (tx: unknown) => provider.signTransaction(tx),
    signAllTransactions: (txs: unknown[]) => provider.signAllTransactions(txs),
  } as unknown as ConstructorParameters<typeof Client>[1];

  const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as
    | "devnet"
    | "mainnet";

  const nosana = new Client(NETWORK, signer, {
    solana: {
      dynamicPriorityFee: true,
      priorityFeeStrategy: "medium",
    },
  });

  const jobPublicKey = new PublicKey(jobAddress.toString());
  const jobDetailsBefore: Job = await nosana.jobs.get(jobPublicKey);
  console.log(`Extending job: ${jobPublicKey.toBase58()}`);

  const extraSeconds = extraMinutes * 60;
  const result = await nosana.jobs.extend(jobPublicKey, extraSeconds);

  const txSig =
    typeof result === "object" && "tx" in result
      ? result.tx
      : result?.toString() || "";

  console.log(`Job extended by ${extraMinutes} minutes. Tx: ${txSig}`);

  const jobDetailsAfter: Job = await nosana.jobs.get(jobPublicKey);
  if (jobDetailsBefore.timeout == jobDetailsAfter.timeout) {
    return {
      txSig,
      result: {
        result: `Job successfully extended by ${extraMinutes} minutes | but it seems that the timeout was not updated verify it from nosana dashboard once 
                => https://dashboard.nosana.com/account/deployer
                `,
      },
    };
  }
  return {
    txSig,
    result: { result: `Job successfully extended by ${extraMinutes} minutes` },
  };
}

// ── API key mode ──

async function extendJobViaApiKey(
  jobAddress: string,
  extraMinutes: number,
): Promise<{ txSig: string; result: { result: string } }> {
  const { nosanaApiKey } = useWalletStore.getState();
  if (!nosanaApiKey) throw new Error("Nosana API key not set");

  const res = await fetch(`${NOSANA_API_BASE}/jobs/extend`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nosanaApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: jobAddress,
      timeout: extraMinutes * 60,
      timeoutSeconds: extraMinutes * 60,
    }),
  });

  if (!res.ok) {
    // Fallback to extend-with-credits
    const res2 = await fetch(`${NOSANA_API_BASE}/jobs/extend-with-credits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${nosanaApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobAddress,
        extensionSeconds: extraMinutes * 60,
      }),
    });

    if (!res2.ok) {
      const errText = await res2.text();
      throw new Error(
        `Failed to extend job via API: ${res2.status} ${errText}`,
      );
    }

    const data = await res2.json();
    return {
      txSig: data.transactionId ?? "",
      result: {
        result: `Job extended by ${extraMinutes} minutes via API (credits).`,
      },
    };
  }

  const data = await res.json();
  return {
    txSig: data.transactionId ?? "",
    result: {
      result: `Job extended by ${extraMinutes} minutes via Nosana API.`,
    },
  };
}

// ── Main entry point ──

export async function extendJob(
  jobAddress: PublicKey | string,
  extraMinutes: number,
): Promise<{ txSig: string; result: { result: string } }> {
  const { authMode, wallet, nosanaApiKey } = useWalletStore.getState();

  if (authMode === "api_key" && nosanaApiKey) {
    return extendJobViaApiKey(jobAddress.toString(), extraMinutes);
  }

  if (wallet) {
    return extendJobViaWallet(jobAddress, extraMinutes);
  }

  throw new Error(
    "Not connected. Please connect a wallet or provide a Nosana API key.",
  );
}
