import { Client , Job} from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import { useWalletStore } from "@/store/wallet.store";


export async function extendJob(
    jobAddress: PublicKey | string,
    extraMinutes: number
): Promise<{ txSig: string; result: { result: string } }> {
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
    
    const nosana = new Client(NETWORK, signer, {
        solana: {
            dynamicPriorityFee: true,
            priorityFeeStrategy: "medium",
        },
    });
    
    const jobPublicKey = new PublicKey(jobAddress.toString());
    const jobDetailsBefore : Job = await nosana.jobs.get(jobPublicKey);
    console.log(`Extending job: ${jobPublicKey.toBase58()}`);
    
    const extraSeconds = extraMinutes * 60;

    const result = await nosana.jobs.extend(jobPublicKey, extraSeconds);

    const txSig = typeof result === 'object' && 'tx' in result
        ? result.tx
        : result?.toString() || '';

    console.log(`Job extended by ${extraMinutes} minutes. Tx: ${txSig}`);

    const jobDetailsAfter : Job = await nosana.jobs.get(jobPublicKey);
    if(jobDetailsBefore.timeout == jobDetailsAfter.timeout) {       
        return {
            txSig, result: {
                result: `Job successfully extended by ${extraMinutes} minutes | but it seems that the timeout was not updated verify it from nosana dashboard once 
                => https://dashboard.nosana.com/account/deployer
                ` }
        };
    }
    return {txSig , result : { result : `Job successfully extended by ${extraMinutes} minutes` }};
}
