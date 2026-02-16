import { Client } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import { useWalletStore } from "@/store/wallet.store";

const NOSANA_API_BASE = "https://dashboard.k8s.prd.nos.ci/api";

// ── Wallet mode ──

async function stopJobViaWallet(
  jobAddress: PublicKey | string,
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
  const job = await nosana.jobs.get(jobPublicKey);

  console.log("Job status:", job.state, "Payer:", job.payer?.toBase58());

  if (job.state !== "RUNNING") {
    console.warn("Job not running, cannot stop.");
    throw new Error("Job not running, cannot stop.");
  }

  const result = await nosana.jobs.end(jobPublicKey);
  console.log("Stop result:", result);

  const txSig =
    typeof result === "object" && result !== null && "tx" in result
      ? (result as { tx: string }).tx
      : typeof result === "string"
        ? result
        : "";

  console.log(`Job stopped. Tx: ${txSig}`);
  const does_job_exist = await nosana.jobs.get(jobPublicKey);

  if (does_job_exist.state !== "COMPLETED") {
    console.warn("Job not stopped, something went wrong.");
    return {
      txSig,
      result: {
        result: `the job stopped successfully with result: tx: ${txSig} but jobs state is ${does_job_exist.state} shows its not stopped  please verify the job state on nosana dashboard https://dashboard.nosana.com`,
      },
    };
  }
  return {
    txSig,
    result: {
      result: `the job stopped successfully with result: tx: ${txSig}`,
    },
  };
}

// ── API key mode ──

async function stopJobViaApiKey(
  jobAddress: string,
): Promise<{ txSig: string; result: { result: string } }> {
  const { nosanaApiKey } = useWalletStore.getState();
  if (!nosanaApiKey) throw new Error("Nosana API key not set");

  // Try stop endpoint
  const res = await fetch(`${NOSANA_API_BASE}/jobs/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nosanaApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address: jobAddress }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (errText.includes("job cannot be delisted except when in queue")) {
      throw new Error(
        "Job is currently running and cannot be force-stopped via API mode until it finishes. On Nosana, credit-based jobs can only be cancelled while they are still in the queue.",
      );
    }
    // Fallback to stop-with-credits
    const res2 = await fetch(`${NOSANA_API_BASE}/jobs/stop-with-credits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${nosanaApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobAddress }),
    });

    if (!res2.ok) {
      const errText = await res2.text();
      throw new Error(`Failed to stop job via API: ${res2.status} ${errText}`);
    }

    const data = await res2.json();
    return {
      txSig: data.tx ?? "",
      result: {
        result: `Job stopped via API (credits). ${data.tx ? `Tx: ${data.tx}` : ""}`,
      },
    };
  }

  const data = await res.json();
  return {
    txSig: data.transactionId ?? data.tx ?? "",
    result: {
      result: `Job stopped successfully. ${data.transactionId ? `Tx: ${data.transactionId}` : ""}`,
    },
  };
}

// ── Main entry point ──

export async function stopJob(
  jobAddress: PublicKey | string,
): Promise<{ txSig: string; result: { result: string } }> {
  const { authMode, wallet, nosanaApiKey } = useWalletStore.getState();

  if (authMode === "api_key" && nosanaApiKey) {
    return stopJobViaApiKey(jobAddress.toString());
  }

  if (wallet) {
    return stopJobViaWallet(jobAddress);
  }

  throw new Error(
    "Not connected. Please connect a wallet or provide a Nosana API key.",
  );
}
