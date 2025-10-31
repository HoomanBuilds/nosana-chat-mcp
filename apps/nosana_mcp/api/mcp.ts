import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "../deployer/registerTools.js";

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
  const publicKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  try {
    return { publicKey };
  } catch (err) {
    console.warn("Invalid token, regenerating...", err);
  }
}

async function verifyJwt(req: any) {
  const result = ensureJwt(req);
  const publicKey = result?.publicKey;
  return {
    token: publicKey || "",
    clientId: publicKey || "",
    scopes: ["nosana:deployer"],
    extra: { publicKey },
  };
}

const handler = createMcpHandler(
  (server) => registerTools(server),
  {
    capabilities: {
      tools: {
        create_job: { description: "Deploy a new Nosana job (host model on a decentralized GPU)" },
        update_job: { description: "Update an existing Nosana job" },
        stop_job: { description: "Stop a running Nosana job" },
        extend_job_runtime: { description: "Extend a job runtime" },
        get_job: { description: "Fetch job details" },
        get_all_jobs: { description: "List all jobs for a user" },
        get_wallet_balance: { description: "Get wallet balance" },
        get_credit_balance: { description: "Get credit balance on nosana platform" },
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
  const publicKey = result?.publicKey;
  const pk = req.headers.get("authorization")


  return new Response(JSON.stringify({ ok: true, publicKey : pk }), {
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