import { NextRequest } from "next/server";
import { CREDIT_CONFIG, getCredits } from "@/lib/credits";

export async function GET(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown-ip";

    const wallet = req.nextUrl.searchParams.get("wallet") || undefined;

    const credits = await getCredits(ip, wallet);

    const baseLimit = CREDIT_CONFIG.DAILY_LIMIT;
    const walletBonus = wallet ? CREDIT_CONFIG.WALLET_BONUS : 0;

    return Response.json({
      identifier: wallet || ip,
      credits,
      baseLimit,
      walletBonus,
      totalLimit: baseLimit + walletBonus,
      ttlSeconds: CREDIT_CONFIG.TTL_SECONDS,
      lastReset: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error("Credit info fetch failed:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
