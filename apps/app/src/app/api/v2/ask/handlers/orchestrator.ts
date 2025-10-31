import { handleModelMode } from "./handleModelMode";
import { Model, Modes } from "@nosana-chat/ai";
import { handleSelfHostedMode } from "./handleSelfHostedMode";
import { handleDeepResearch, handleProSearch } from "./handelMode";
import { Payload } from "@/lib/utils/validation";
import { handleDeployment } from "./DeploymentHandler";


export async function orchestrateProvider(
    payload: Payload,
    send: (event: string, data: string) => void
) {
    const [provider, modelName] = payload.model?.split("/") ?? [];

    // Tools
    if (typeof payload.mode != undefined) {
        switch (payload.mode) {
            case "deployer":
                console.log("===deployer triggered===");
                return handleDeployment(payload, send);
        }
    }

    // Custom provider
    // if (provider === "custom") {
    //     if (modelName == Modes.ChatMode.ZERO) return handleZeroMode(payload, send);
    //     else if (modelName == Modes.ChatMode.AUTO) return handleAutoMode(payload, send)
    // }

    // Model provider
    if (Object.keys(Model.ModelConfigs).includes(modelName)) {
        if (provider === "self") return handleSelfHostedMode(payload, send);
        else return handleModelMode(payload, send);
    }

    // Mode provider
    if (provider === "mode") {
        if (modelName == Modes.ChatMode.Deep) return handleDeepResearch(payload, send);
        else if (modelName == Modes.ChatMode.Pro) return handleProSearch(payload, send);
    }

    send("error", JSON.stringify({
        message: "Invalid configuration for provider - custom, mode, or gemini only",
        code: 400
    }));
}
