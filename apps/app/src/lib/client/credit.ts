// browser-only util — do not import in server code

const STORAGE_KEY = "remainingCredits";

export function updateRemainingCredits(res: Response): void {
  const header = res.headers.get("x-remaining-credits");
  if (!header) return;

  const remaining = Number(header);
  if (!isNaN(remaining)) {
    localStorage.setItem(STORAGE_KEY, String(remaining));
  }
}

export function getRemainingCredits(): number {
  const val = localStorage.getItem(STORAGE_KEY);
  return val ? Number(val) : 0;
}

export function clearCredits(): void {
  localStorage.removeItem(STORAGE_KEY);
}
