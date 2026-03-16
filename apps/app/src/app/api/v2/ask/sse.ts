import { getFollowUpQuestions } from "@/lib/tools";
import { orchestrateProvider } from "./handlers/orchestrator";
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

      const threadCheckPromise = (async () => {
        if (payload.chats && payload.chats.length <= 1 && payload.query) {
          const threadTitle = payload.query.substring(0, 30) + (payload.query.length > 30 ? "..." : "");
          send("threadTitle", threadTitle);
        }
      })();

      const providerPromise = orchestrateProvider(payload as Payload, send);
      const isCustomServiceInference = Boolean(payload.deployedModel?.baseURL);

      const followUpPromise =
        payload.mode != "deployer" &&
          (payload?.customConfig ? payload?.customConfig?.followUp : true) &&
          !isCustomServiceInference
          ? getFollowUpFromPayload(payload, send)
          : Promise.resolve();

      try {
        await Promise.allSettled([
          providerPromise,
          threadCheckPromise,
          followUpPromise
        ]);
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
    // Avoid splitting a word in half when trimming
    const sliced = combinedQuery.slice(-MAX_LENGTH);
    const firstSpaceIndex = sliced.indexOf(" ");
    combinedQuery = firstSpaceIndex !== -1 ? sliced.slice(firstSpaceIndex + 1) : sliced;
  }

  return combinedQuery
    ? getFollowUpQuestions(combinedQuery, send, payload.model).catch(
      (err: Error) => {
        console.error("Follow-up error:", err);
        return;
      },
    )
    : Promise.resolve();
}
