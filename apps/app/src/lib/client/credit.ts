// browser-only util — do not import in server code

const STORAGE_KEY = "remainingCredits";
const FREE_CREDIT_LIMIT = 10;

function normalizeCredits(value: number): number {
  if (Number.isNaN(value)) return FREE_CREDIT_LIMIT;
  if (value < 0) return 0;
  if (value > FREE_CREDIT_LIMIT) return FREE_CREDIT_LIMIT;
  return value;
}

export function updateRemainingCredits(res: Response): void {
  const header = res.headers.get("x-remaining-credits");
  if (!header) return;

  const remaining = Number(header);
  if (!isNaN(remaining)) {
    localStorage.setItem(STORAGE_KEY, String(normalizeCredits(remaining)));
  }
}

export function getRemainingCredits(): number {
  const val = Number(localStorage.getItem(STORAGE_KEY));
  const normalized = normalizeCredits(val);
  localStorage.setItem(STORAGE_KEY, String(normalized));
  return normalized;
}

export function clearCredits(): void {
  localStorage.removeItem(STORAGE_KEY);
}
