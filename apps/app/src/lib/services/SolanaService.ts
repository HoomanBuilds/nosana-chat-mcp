import { PublicKey, Connection } from "@solana/web3.js";
import { useWalletStore } from "@/store/wallet.store";

export class SolanaService {
  private static connection: Connection | null = null;

  static getConnection(): Connection {
    if (!this.connection) {
      const endpoint =
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com";
      this.connection = new Connection(endpoint, "confirmed");
    }
    return this.connection;
  }

  static isValidPublicKey(key: string): boolean {
    try {
      new PublicKey(key);
      return true;
    } catch {
      return false;
    }
  }

  static async getBalances(userPublicKey: string) {
    const { isConnected, wallet, nosanaApiKey, isApiKeyConnected } =
      useWalletStore.getState();

    // Logic for fetching balances based on auth mode
    // This can be expanded to call the Nosana SDK or API
    return {
      sol: 0, // Placeholder
      nos: 0, // Placeholder
    };
  }
}
