import { getFollowUpQuestions } from "@/lib/tools";
import { orchestrateProvider } from "./handlers/orchestrator";
import { getThreadTitle } from "./handlers/utils";
import { Payload } from "@/lib/utils/validation";

export function createSSEStream(payload?: Payload) {
  if (!payload) {
    throw new Error("payload is required");
  }

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: string) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      if (
        payload.signal &&
        payload.signal instanceof AbortSignal &&
        typeof payload.signal.addEventListener === "function"
      ) {
        payload.signal.addEventListener("abort", () => {
          send("error", "stream aborted by user");
          controller.close();
        });
      }

      const threadCheckPromise = Promise.resolve();
      // (async () => {
      //   if (payload.chats && payload.chats.length === 0 && payload.query && process.env.GOOGLE_API_KEY) {
      //     const threadTitle = await getThreadTitle(payload.query, payload.apiKeys?.["gemini"] || process.env.GOOGLE_API_KEY);
      //     send("threadTitle", threadTitle);
      //   }
      // })();

      const providerPromise = orchestrateProvider(payload as Payload, send);

      const followUpPromise = Promise.resolve();
      // const apiKey = payload.apiKeys?.["gemini"] || process.env.GOOGLE_API_KEY;
      // const followUpPromise = (payload.mode != "deployer" && apiKey && (payload?.customConfig ? payload?.customConfig?.followUp : true))
      //   ? getFollowUpFromPayload(payload, send)
      //   : Promise.resolve();

      try {
        await Promise.all([providerPromise, threadCheckPromise]);
        await followUpPromise;
      } catch (err) {
        send("error", JSON.stringify({ message: (err as Error).message }));
      } finally {
        send("event", "");
        controller.close();
      }
    },
  });
}

function getFollowUpFromPayload(
  payload: Payload,
  send: (event: string, data: string) => void,
) {
  const MAX_LENGTH = 2000;

  const userMessages = (payload.chats || [])
    .filter((msg: { role: string }) => msg.role === "user")
    .slice(-4);

  let combinedQuery = userMessages
    .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
    .concat(payload.query ? `user: ${payload.query}` : [])
    .filter(Boolean)
    .join("\n");

  if (combinedQuery.length > MAX_LENGTH) {
    combinedQuery = combinedQuery.slice(-MAX_LENGTH);
  }

  return combinedQuery
    ? getFollowUpQuestions(combinedQuery, send, payload.apiKeys).catch(
        (err: Error) => {
          console.error("Follow-up error:", err);
          return;
        },
      )
    : Promise.resolve();
}
