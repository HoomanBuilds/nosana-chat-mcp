// browser-only util — do not import in server code

const REMAINING_STORAGE_KEY = "remainingCredits";
const LIMIT_STORAGE_KEY = "creditLimit";
const FREE_CREDIT_LIMIT = 10;
const CREDITS_UPDATED_EVENT = "credits-updated";

function normalizeLimit(value: number): number {
  if (Number.isNaN(value)) return FREE_CREDIT_LIMIT;
  if (value <= 0) return FREE_CREDIT_LIMIT;
  return value;
}

function normalizeCredits(value: number, limit: number): number {
  if (Number.isNaN(value)) return FREE_CREDIT_LIMIT;
  if (value < 0) return 0;
  if (value > limit) return limit;
  return value;
}

function notifyCreditUpdate(): void {
  window.dispatchEvent(new Event(CREDITS_UPDATED_EVENT));
}

function readCreditLimitFromStorage(): number {
  return normalizeLimit(Number(localStorage.getItem(LIMIT_STORAGE_KEY)));
}

function writeCredits(remaining: number, limit: number): void {
  const normalizedLimit = normalizeLimit(limit);
  const normalizedRemaining = normalizeCredits(remaining, normalizedLimit);
  localStorage.setItem(LIMIT_STORAGE_KEY, String(normalizedLimit));
  localStorage.setItem(REMAINING_STORAGE_KEY, String(normalizedRemaining));
  notifyCreditUpdate();
}

export function updateRemainingCredits(res: Response): void {
  const header = res.headers.get("x-remaining-credits");
  if (!header) return;

  const limitHeader = Number(res.headers.get("x-credit-limit"));
  const limit = Number.isNaN(limitHeader)
    ? readCreditLimitFromStorage()
    : limitHeader;
  const remaining = Number(header);
  if (!isNaN(remaining)) {
    writeCredits(remaining, limit);
  }
}

export function getRemainingCredits(): number {
  const limit = readCreditLimitFromStorage();
  const raw = localStorage.getItem(REMAINING_STORAGE_KEY);
  const val = raw == null ? limit : Number(raw);
  const normalized = normalizeCredits(val, limit);
  localStorage.setItem(REMAINING_STORAGE_KEY, String(normalized));
  localStorage.setItem(LIMIT_STORAGE_KEY, String(limit));
  return normalized;
}

export function getCreditLimit(): number {
  const limit = readCreditLimitFromStorage();
  localStorage.setItem(LIMIT_STORAGE_KEY, String(limit));
  return limit;
}

export async function refreshCreditsFromServer(wallet?: string): Promise<{
  remaining: number;
  limit: number;
} | null> {
  try {
    const query = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
    const res = await fetch(`/api/credits${query}`, { cache: "no-store" });
    if (!res.ok) return null;

    const json = await res.json();
    if (typeof json?.credits !== "number" || typeof json?.totalLimit !== "number") {
      return null;
    }

    writeCredits(json.credits, json.totalLimit);
    return {
      remaining: getRemainingCredits(),
      limit: getCreditLimit(),
    };
  } catch {
    return null;
  }
}

export function onCreditsUpdated(handler: () => void): () => void {
  window.addEventListener(CREDITS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(CREDITS_UPDATED_EVENT, handler);
}

export function clearCredits(): void {
  localStorage.removeItem(REMAINING_STORAGE_KEY);
  localStorage.removeItem(LIMIT_STORAGE_KEY);
  notifyCreditUpdate();
}
