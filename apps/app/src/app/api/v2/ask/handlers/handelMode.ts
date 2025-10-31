import { Payload } from "@/lib/utils/validation";

export const handleDeepResearch = async (
  payload: Payload,
  send: (event: string, data: string | any) => void
) => {
  send("llmResult", "the deep research result")
};

export const handleProSearch = async (
  payload: Payload,
  send: (event: string, data: string | any) => void
) => {
  send("llmResult", "pro search")
};