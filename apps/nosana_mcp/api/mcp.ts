import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "../deployer/registerTools.js";
import { detectAuthMode } from "../deployer/utils/types.js";

const allowedOrigins = [
  "https://nosanachat.inferia.ai",
  "https://llmvarious.vercel.app",
];

if (process.env.NODE_ENV === "development") {
  allowedOrigins.push("*");
}
function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return null;

  if (!allowedOrigins.includes(origin)) {
    console.warn("Blocked origin:", origin);
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}


function ensureJwt(req: any) {
  const authHeader = req.headers?.get?.("authorization");
  const credential = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  try {
    return { credential };
  } catch (err) {
    console.warn("Invalid token, regenerating...", err);
  }
}

async function verifyJwt(req: any) {
  const result = ensureJwt(req);
  const credential = result?.credential;

  // Detect auth mode: API key (nos_xxx_...) or wallet public key
  const authMode = credential ? detectAuthMode(credential) : 'wallet';

  return {
    token: credential || "",
    clientId: credential || "",
    scopes: ["nosana:deployer"],
    extra: {
      publicKey: credential,
      authMode,
    },
  };
}

const handler = createMcpHandler(
  (server) => registerTools(server),
  {
    capabilities: {
      tools: {
        create_job: { description: "Deploy a new Nosana job (host model on a decentralized GPU) — wallet or API key" },
        create_deployment: { description: "Create a deployment via Nosana API (API key mode only)" },
        list_deployments: { description: "List all deployments (API key mode)" },
        get_deployment: { description: "Get deployment details (API key mode)" },
        stop_deployment: { description: "Stop a deployment (API key mode)" },
        update_job: { description: "Update an existing Nosana job" },
        stop_job: { description: "Stop a running Nosana job — wallet or API key" },
        extend_job_runtime: { description: "Extend a job runtime — wallet or API key" },
        get_job: { description: "Fetch job details — wallet or API key" },
        get_all_jobs: { description: "List all jobs for a user" },
        get_wallet_balance: { description: "Get wallet balance (wallet mode)" },
        get_credit_balance: { description: "Get credit balance on nosana platform — wallet or API key" },
        estimate_job_cost: { description: "Estimate cost for a Nosana job" },
      },
    },
  },
  {
    redisUrl: process.env.REDIS_URL,
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  }
);

const authHandler = withMcpAuth(handler, verifyJwt, {
  required: true,
  requiredScopes: ["nosana:deployer"],
});


export async function GET(req: Request) {
  const forbidden = checkOrigin(req);
  if (forbidden) return forbidden;

  const result = ensureJwt(req);
  const credential = result?.credential;
  const authMode = credential ? detectAuthMode(credential) : 'unknown';

  return new Response(JSON.stringify({
    ok: true,
    authMode,
    credential: credential ? `${credential.slice(0, 8)}...` : null,
  }), {
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin")!,
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

export async function POST(req: any) {
  const forbidden = checkOrigin(req);
  if (forbidden) return forbidden;

  const res = await authHandler(req.clone ? req.clone() : req);
  res.headers.append(
    "Access-Control-Allow-Origin",
    req.headers.get("origin")!
  );
  res.headers.append("Access-Control-Allow-Credentials", "true");

  return res;
}


export async function OPTIONS(req: Request) {
  const forbidden = checkOrigin(req);
  if (forbidden) return forbidden;

  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin")!,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}


export const runtime = "nodejs";