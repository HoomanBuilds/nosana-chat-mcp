import { Client } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import { useWalletStore } from "@/store/wallet.store";

export async function stopJob(jobAddress: PublicKey | string): Promise<{ txSig: string; result: { result: string } }> {
    const { wallet, provider } = useWalletStore.getState();
    if (!provider || !wallet) throw new Error("Wallet not connected");

    const signer = {
        publicKey: provider.publicKey,
        payer: provider.publicKey,
        signTransaction: (tx: any) => provider.signTransaction(tx),
        signAllTransactions: (txs: any[]) => provider.signAllTransactions(txs),
    };

    const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "devnet" | "mainnet";
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
            txSig, result: {
                result: `the job stopped successfully with result: tx: ${txSig} but jobs state is ${does_job_exist.state} shows its not stopped  please verify the job state on nosana dashboard https://dashboard.nosana.com`
            }
        };
    }
    return { txSig, result: { result: `the job stopped successfully with result: tx: ${txSig}` } };
}