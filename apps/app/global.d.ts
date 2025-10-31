export {};

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString(): string } }>;
      disconnect: () => void;
      on: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}