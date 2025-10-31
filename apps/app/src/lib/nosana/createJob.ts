import { Client, Job, getJobExposedServices } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import { useWalletStore } from "@/store/wallet.store";

export async function createJob(
  jobDef: object,
  userSelectedMarketKey: PublicKey | string,
  minutes: number
) {
  const { wallet, provider } = useWalletStore.getState();
  if (!provider || !wallet) throw new Error("Wallet not connected");

  const signer = {
    publicKey: provider.publicKey,
    payer: provider.publicKey,
    signTransaction: (tx: any) => provider.signTransaction(tx),
    signAllTransactions: (txs: any[]) => provider.signAllTransactions(txs),
  };

  const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as
    | "devnet"
    | "mainnet";
  const marketPublicKey = new PublicKey(userSelectedMarketKey.toString());

  const nosana = new Client(NETWORK, signer, {
    solana: {
      dynamicPriorityFee: true,
      priorityFeeStrategy: "medium",
    },
  });

  const ipfsHash = await nosana.ipfs.pin(jobDef);
  console.log("Job pinned to IPFS:", ipfsHash);

  const res = await nosana.jobs.list(ipfsHash, minutes * 60, marketPublicKey);
  if (!("job" in res)) throw new Error("Unexpected response from Nosana");

  console.log(`Job ${res.job} posted to market ${marketPublicKey.toBase58()}`);

  const jobId = res.job;
  const job: Job = await nosana.jobs.get(jobId);

  const services = getJobExposedServices(jobDef as any, jobId);
  const firstService = services.length > 0 ? services[0] : null;

  const nodeDomain =
    NETWORK === "mainnet" ? "node.k8s.prd.nos.ci" : "node.k8s.dev.nos.ci";
  const serviceUrl = firstService
    ? `https://${firstService.hash}.${nodeDomain}`
    : `https://${jobId}.${nodeDomain}`;

  const log: NosanaJobLog = {
    wallet,
    ipfsHash,
    market: marketPublicKey.toBase58(),
    timeOut: minutes * 60,
    jobResponse: res,
    jobId: res.job,
    ipfsUrl: nosana.ipfs.config.gateway + ipfsHash,
    marketUrl: `https://dashboard.nosana.com/markets/${marketPublicKey.toString()}`,
    serviceUrl,
    explorerUrl: `https://dashboard.nosana.com/jobs/${res.job}`,
    chatUrl: `https://www.inferia.ai/chat/${firstService?.hash || jobId}.${nodeDomain}?jobId=${res.job}`,
    jobDetails: job,
  };

  const response_to_send = { ...job, ...res, ...log };
  console.log("Job complete:");
  return { jobId, result: { jobDetails: response_to_send } };
}

export type NosanaJobLog = {
  wallet: string;
  ipfsHash: string;
  market: string;
  timeOut: number;
  jobResponse: any;
  jobId: string;
  ipfsUrl: string;
  marketUrl: string;
  serviceUrl: string;
  explorerUrl: string;
  chatUrl: string;
  jobDetails: any;
};
