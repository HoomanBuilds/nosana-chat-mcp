import { handleInferenceMode } from "./handleInferenceMode";
import { Payload } from "@/lib/utils/validation";
import { handleDeployment } from "./DeploymentHandler";

export async function orchestrateProvider(
  payload: Payload,
  send: (event: string, data: string) => void,
) {
  // Tools
  if (payload.mode === "deployer") {
    console.log("===deployer triggered===");
    return handleDeployment(payload, send);
  }

  // Default to inference endpoint handler for all requests
  return handleInferenceMode(payload, send);
}
