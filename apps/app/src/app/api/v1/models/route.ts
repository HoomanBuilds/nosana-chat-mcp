import { NextResponse } from "next/server";

function joinModelUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/models`;
}

export async function GET() {
  const provider = process.env.LLM_PROVIDER || "inferia";
  let baseUrl = process.env.NEXT_PUBLIC_INFERIA_LLM_URL;
  let apiKey = process.env.INFERIA_LLM_API_KEY;

  if (provider === "deepseek") {
    baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
    apiKey = process.env.DEEPSEEK_API_KEY;
  }

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error: `Missing configuration for provider: ${provider}`,
      },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(joinModelUrl(baseUrl), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch models from upstream",
          status: res.status,
          details: data,
        },
        { status: res.status },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to fetch models" },
      { status: 500 },
    );
  }
}
