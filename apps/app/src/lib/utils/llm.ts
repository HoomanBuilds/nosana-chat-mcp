export function normalizeInferenceBaseURL(rawUrl: string): string {
    if (!rawUrl) return "";
    const trimmed = rawUrl.trim().replace(/\/+$/, "");
    if (!trimmed) return trimmed;

    if (trimmed.endsWith("/v1/chat/completions")) {
        return trimmed.replace(/\/chat\/completions$/, "");
    }
    if (trimmed.endsWith("/chat/completions")) {
        return trimmed.replace(/\/chat\/completions$/, "");
    }
    if (trimmed.endsWith("/v1")) {
        return trimmed;
    }
    return `${trimmed}/v1`;
}

export const COMMON_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://nosana.chat/",
};
