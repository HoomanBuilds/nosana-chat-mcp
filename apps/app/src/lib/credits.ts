import { kv } from "@vercel/kv";

export const CREDIT_CONFIG = {
  DAILY_LIMIT: 10,
  WALLET_BONUS: 0,
  MESSAGE_COST: 1,
  TTL_SECONDS: 60 * 60 * 24,
};

export const CREDIT_LIMIT_ERROR_CODE = "CREDIT_LIMIT_REACHED";
export const CREDIT_LIMIT_MESSAGE =
  "You have used all 10 credits. Please deploy your own model using Nosana Deployer to continue.";

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeKey(identifier: string): string {
  return `credits:${identifier}:${getDateKey()}`;
}

function getBaseCredits(wallet?: string): number {
  return CREDIT_CONFIG.DAILY_LIMIT + (wallet ? CREDIT_CONFIG.WALLET_BONUS : 0);
}

export async function getCredits(ip: string, wallet?: string): Promise<number> {
  const id = wallet || ip;
  if (!id) throw new Error("Missing IP or wallet identifier");

  const key = makeKey(id);
  let credits = await kv.get<number>(key);

  if (credits == null) {
    credits = getBaseCredits(wallet);
    await kv.set(key, credits, { ex: CREDIT_CONFIG.TTL_SECONDS });
  }

  return credits;
}

export async function checkCredits(
  ip: string,
  _model: string,
  wallet?: string
): Promise<{ ok: boolean; remaining: number }> {
  const remaining = await getCredits(ip, wallet);
  const cost = CREDIT_CONFIG.MESSAGE_COST;
  return { ok: remaining >= cost, remaining };
}

export async function deductCredits(
  ip: string,
  _model: string,
  wallet?: string
): Promise<number> {
  const id = wallet || ip;
  if (!id) throw new Error("Missing IP or wallet identifier");

  const key = makeKey(id);
  const cost = CREDIT_CONFIG.MESSAGE_COST;
  const current = await getCredits(ip, wallet);

  if (current < cost) throw new Error(CREDIT_LIMIT_ERROR_CODE);

  const newBalance = current - cost;
  await kv.set(key, newBalance, { ex: CREDIT_CONFIG.TTL_SECONDS });
  return newBalance;
}

export async function resetCredits(ip: string, wallet?: string): Promise<void> {
  const id = wallet || ip;
  const key = makeKey(id);
  await kv.set(key, getBaseCredits(wallet), { ex: CREDIT_CONFIG.TTL_SECONDS });
}

export async function addCredits(
  ip: string,
  amount: number,
  wallet?: string
): Promise<number> {
  const id = wallet || ip;
  const key = makeKey(id);
  const current = await getCredits(ip, wallet);
  const updated = current + amount;
  await kv.set(key, updated, { ex: CREDIT_CONFIG.TTL_SECONDS });
  return updated;
}
