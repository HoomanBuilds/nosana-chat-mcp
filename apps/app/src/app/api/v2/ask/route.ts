import { NextRequest } from "next/server";
import { SSE_HEADERS } from "@/lib/types";
import { chatRequestSchema, Payload } from "@/lib/utils/validation";
import { createSSEStream } from "./sse";
import { registerApiKeys } from "./handlers/utils";
import {
  CREDIT_CONFIG,
  CREDIT_LIMIT_ERROR_CODE,
  CREDIT_LIMIT_MESSAGE,
  deductCredits,
  getCredits,
} from "@/lib/credits";

export async function POST(req: NextRequest) {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: SSE_HEADERS });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  const controller = new AbortController();
  const { signal } = controller;

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parseResult = chatRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = parseResult.data;

  const geo = req.headers.get("x-vercel-ip-country")
    ? {
        country: req.headers.get("x-vercel-ip-country")!,
        region: req.headers.get("x-vercel-ip-country-region") || "",
        city: req.headers.get("x-vercel-ip-city") || "",
      }
    : undefined;

  const PayloadPro: Payload = {
    ...data,
    ...(geo ? { geo } : {}),
    signal,
    apiKeys: data.apiKeys ?? {},
  };

  registerApiKeys(PayloadPro, req.headers);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown-ip";
  const totalCredits =
    CREDIT_CONFIG.DAILY_LIMIT +
    (data.walletPublicKey ? CREDIT_CONFIG.WALLET_BONUS : 0);
  const bypassCredits = data.mode === "deployer" || !!data.deployedModel;

  let remainingCredits = 0;
  if (bypassCredits) {
    remainingCredits = await getCredits(ip, data.walletPublicKey).catch(() => 0);
  } else {
    try {
      remainingCredits = await deductCredits(ip, data.model, data.walletPublicKey);
      console.log(
        `💳 [${data.walletPublicKey ? "wallet" : "ip"}:${
          data.walletPublicKey || ip
        }] used ${data.model} → remaining: ${remainingCredits}`,
      );
    } catch (err) {
      if ((err as Error).message === CREDIT_LIMIT_ERROR_CODE) {
        return new Response(
          JSON.stringify({
            error: CREDIT_LIMIT_MESSAGE,
            code: CREDIT_LIMIT_ERROR_CODE,
          }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "x-remaining-credits": "0",
              "x-credit-limit": String(totalCredits),
            },
          },
        );
      }

      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const stream = createSSEStream(PayloadPro);
    return new Response(stream, {
      headers: {
        ...SSE_HEADERS,
        "x-remaining-credits": String(remainingCredits),
        "x-credit-limit": String(totalCredits),
      },
    });
  } catch (err) {
    console.error("SSE stream failed:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const config = {
  runtime: "nodejs",
};
