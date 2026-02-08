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

      const threadCheckPromise = (async () => {
        if (payload.chats && payload.chats.length === 0 && payload.query) {
          const threadTitle = await getThreadTitle(
            payload.query,
            payload.model,
          );
          send("threadTitle", threadTitle);
        }
      })();

      const providerPromise = orchestrateProvider(payload as Payload, send);

      const followUpPromise =
        payload.mode != "deployer" &&
        (payload?.customConfig ? payload?.customConfig?.followUp : true)
          ? getFollowUpFromPayload(payload, send)
          : Promise.resolve();

      try {
        let followUpResolved = false;
        followUpPromise.then(() => {
          followUpResolved = true;
        });

        await Promise.all([providerPromise, threadCheckPromise]);

        await followUpPromise;
        if (!followUpResolved && payload.customConfig?.followUp) {
          send("event", "generating follow-up");
        }
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
    ? getFollowUpQuestions(combinedQuery, send, payload.model).catch(
        (err: Error) => {
          console.error("Follow-up error:", err);
          return;
        },
      )
    : Promise.resolve();
}
