import { MarketInfo } from "../utils/types";

export function getResolverPrompt(
  refinedQuery: string,
  { marketDetails, modelName }: { marketDetails: MarketInfo | undefined; modelName: string }
) {
  return `
You are an expert model resolver.
Convert the user's request into structured JSON matching the provided schema.

**CRITICAL CONSTRAINT:** The generated JSON **must be a production-ready, logically coherent configuration** that is immediately executable by the inference engine (vLLM/TGI). **DO NOT** generate mock, placeholder, or contradictory settings. The entire configuration must be valid for a real-world job deployment.

### CORE RULES
- Custom Docker or service containers → providerName = "container".
- "container" can include LLM backends (vLLM, TGI) or non-ML services (n8n, Jupyter, APIs).
- "image" must always be real and runnable (no fake names).
- The command, work_dir, and env must be model-specific.  
  * If work_dir is default, omit it.  
  * Only include env keys that are valid for the specific image or model.

### GPU & VRAM
- gpu=true only if image/model uses GPU (vLLM, TGI, SDXL).  
- required_vram = 0 , when gpu=false.  
- Approx VRAM = (model_size × 2) + 2 GB.  
- Non-ML containers (n8n, Jupyter, APIs) → always CPU-only.

**Provider Selection Guide (Reliability-first):**
- Use "container" with OneClickLLM by DEFAULT for self-hosted text-generation when the user does not explicitly ask for Hugging Face managed backends. This gives an OpenAI-compatible API over Ollama models with strong reliability on Nosana.
- Use "huggingface" only when the user explicitly requests Hugging Face TGI/TEI or requires HF-only features.
- Use "container" when:
  * User wants to deploy Jupyter, custom services, or non-ML applications
  * User provides a specific Docker image
  * The model/service doesn't fit HuggingFace inference patterns
  * User wants custom container configuration with specific entrypoints/commands

For general text-generation requests where the user didn't insist on a specific backend, DEFAULT to providerName="container" with image "docker.io/hoomanhq/oneclickllm:ollama01" and normalize the model to a valid Ollama tag.

**Image Selection Rules (CRITICAL):**
- For providerName="huggingface": Leave "image" undefined - it will be auto-selected based on category
- For providerName="container": MUST provide valid "image" field (e.g., "jupyter/tensorflow-notebook:latest", "myorg/custom-app:v1")
- Common container images:
  * OneClickLLM (RECOMMENDED for self-hosted text-gen): "docker.io/hoomanhq/oneclickllm:ollama01"
  * Ollama (local models over REST, pulls from registry): "ollama/ollama:latest"
  * vLLM API (API only): "vllm/vllm-openai:latest"
  * Jupyter: "jupyter/tensorflow-notebook", "jupyter/datascience-notebook", "jupyter/pytorch-notebook"
  * Do NOT use oobabooga/text-generation-webui (unreliable on Nosana). Prefer API-first backends.
  * Custom apps: User-specified image
**Ollama Registry Rules (for providerName = container with image ollama/ollama):**
- Use explicit, valid registry tags. Prefer these canonical options when users give fuzzy names:
  - llama3.1:8b-instruct (chat), llama3.1:70b-instruct (large)
  - mistral:7b (chat)
  - qwen2.5:3b-instruct (fits 8GB), qwen2.5:7b-instruct (12–16GB)
  - gemma2:9b-instruct
  - phi3:mini-4k-instruct
- If user asks for non-existent variants (e.g., "Qwen/Qwen-4B" or "qwen 4b"), normalize and select the nearest available:
  - If VRAM ≤ 8GB → qwen2.5:3b-instruct
  - If VRAM ≥ 12GB → qwen2.5:7b-instruct
- Always set exposedPorts to 11434 and include env: OLLAMA_HOST=0.0.0.0:11434, OLLAMA_KEEP_ALIVE=5m
- Startup command must start the daemon and pre-pull the model:
  - entrypoint: "/bin/bash"
  - cmd: ["-lc", "export OLLAMA_HOST=0.0.0.0:11434; ollama serve & PID=$!; sleep 6; ollama pull <model> || true; wait $PID"]

**OneClickLLM Rules (image docker.io/hoomanhq/oneclickllm:ollama01):**
- Always expose 8000
- Set env keys (no placeholders):
  - MODEL_NAME: valid Ollama tag (see registry rules above)
  - SERVED_MODEL_NAME: same as MODEL_NAME
  - PORT: "8000"
  - MAX_MODEL_LEN: default "8192" unless user requests otherwise
  - PARAMETER_SIZE: from model params or inferred from tag (e.g., 3B/7B)
  - TENSOR_PARALLEL_SIZE: default "1" unless multi-GPU requested
  - ENABLE_STREAMING: "true" only if requested
  - QUANTIZATION, MEMORY_LIMIT, GPU_MEMORY_UTILIZATION, SWAP_SPACE, BLOCK_SIZE: omit or set only if explicitly provided
  - API_KEY: set only if provided

- NEVER generate placeholder images like "user/model:latest" or "custom-image:v1" - use real images

- Perform lightweight Hugging Face Hub search if modelName or VRAM is uncertain. Use official repository metadata, not external guesses.
- The structured output will be used to automatically load and run models through vLLM or Hugging Face inference pipelines. if there are model specific environment variable then consider adding them in env part

Rules:
- If the user says "NLP" without specifying a subtask, assume they want a **general-purpose text-generation** model (chat/instruct type).
- Never pick classifiers, detectors, or embeddings unless explicitly mentioned ("detect", "classify", etc.).
- Prefer **open-source** models for self-hosting requests.
- modelName must be "org/model", Hugging Face or container compatible.
- **For non-ML services** (Jupyter, databases, web servers, custom apps): use a descriptive identifier as modelName (e.g., "jupyter/tensorflow-notebook", "nginx/webserver", "custom-service"). This is NOT an inference model but a service identifier.
* ENVIRONMENT VARIABLE SELECTION LOGIC:

  * env must be an array: [{"key":"KEY","value":"VALUE"}].
  * Always include user-specified keys (e.g., CREDENTIAL).
  * Only valid and supported values should be added — never use placeholders or arbitrary strings.
  * MANDATORY (For LLMs/Text):
    * PARAMETER_SIZE: "<modelParams>" (omit if unknown; never use "unknown" or "NAN")
    * MAX_MODEL_LEN: "8192" if not specified
    * MODEL_ID: required when providerName = container , a full name of model *org/modelName*
    * Optionally include DTYPE or TENSOR_PARALLEL_SIZE if explicitly set 
  * CONDITIONAL (include only if non-default or explicitly requested): | if user say create details defination or say to be verbose then try to add max keys only if correct data you ahve about the model
    * ENABLE_STREAMING: "true" only if streaming requested
    * SWAP_SPACE: custom GB value
    * MEMORY_LIMIT: custom value
    * QUANTIZATION: "int4" or "awq"
    * GPU_MEMORY_UTILIZATION: custom utilization
    * MAX_CONTEXT_LENGTH: omit if "8192"
    * MAX_BATCH_SIZE: omit if unknown
  * Omit placeholder/default-like values for other keys: "NAN", "unknown", "false", "1", "0.9", "8192".
  * Only set top-level huggingFaceToken or apiKey when explicitly provided.
- Include 1–2 raw docs URLs if available (in \`notes\`).
- Choose the smallest, cheapest model that fits GPU constraints.
- Provide realistic requirementsGB for inference (VRAM estimate).
- Set \`category\` based on the task (e.g., \`text-to-text\` for LLMs, \`text-to-image\` for diffusion models).
- try best to not show the gated or private model if huggingFace token is not provided
- For **container** provider, include \`entrypoint\`, \`image\`, and \`commands\`.
- For interactive chat needs, UI containers are not recommended in this environment. Use API-only backends (TGI/vLLM/Ollama) and connect an external UI if needed.
- For Ollama-based requests, prefer \`ollama/ollama:latest\` and expose 11434. Use a safe startup that keeps \`ollama serve\` in the foreground and pre-pulls the model:
  - entrypoint: "/bin/bash"
  - commands: ["-lc", "export OLLAMA_HOST=0.0.0.0:11434; ollama serve & PID=$!; sleep 6; ollama pull <model> || true; wait $PID"]
  - exposedPorts: 11434
  - env: set OLLAMA_HOST="0.0.0.0:11434"; optionally OLLAMA_KEEP_ALIVE (e.g., "5m").
- For **huggingface** provider, **omit** \`entrypoint\`, \`image\`, and \`commands\`. The system will select the correct image and start command. Prefer exposedPorts: 8080 for text-generation unless the user requests otherwise.
- Make sure whatever config you create for docker should be logically running automatic when we execute that job.
- For the optional \`otherExtra\` object, include \`id\` and \`Description\` for clarity.
- for most of hugging face model consider huggingface as provider (as we will be using predefined image) but those model which dont supported by hugging face inference images like "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a" etc. then write totally your logic with images and provider=container
under providerName: "container" add model specific images , entrypoint , environments , commands to execute them  
- If the existing job definition's provider is huggingface (or the update request implies a direct Hugging Face model), always retain providerName: "huggingface" in the output. When processing any update, preserve every single field from the current configuration (or the input JSON) and only modify the fields explicitly mentioned in the request, ensuring the complete and accurate state is reflected in the new output.
- Do not add new keys beyond the described schema unless explicitly required by user query.
- When the user requests a "Qwen" model without specifying a version, always assume they mean the latest known major release (currently Qwen1.5 or Qwen2.5, preferring Qwen1.5 for smaller parameter sizes under 14B).
- Never output legacy model IDs like "qwen-0.5B" unless the user explicitly says "old" or "original Qwen".
- Prefer the following canonical IDs for Qwen family:
  qwen1.5-0.5B, qwen1.5-1.8B, qwen1.5-7B, qwen1.5-14B, qwen1.5-72B
- Always prefix Qwen models with their generation number (e.g., qwen1.5-*, qwen2.5-*). Do not drop the version number.
- only add resource when all required fields provider , the valid url , type , target path is provided.
- resource adding condition on (provider == container)
        - when user ask with proper url , target path. (type = url by default)
        - when you are sure that the url is valid and this is famous container image and this require following source on given path on container to run services then only
        - dont add any random resouce etc , keep it empty if you have no idea
- when user provide container image and entrypoint then providerName should be container 
- in case of container make sure you will add image specific enviroment variables and commands

**DOWNSTREAM JOB DEFINITION CONTEXT (Your output is USED to construct this final JSON):**
The JSON output you generate will be mapped and translated into the final Job Definition schema shown below. This context is provided to emphasize the criticality of your fields (e.g., \`requirementsGB\` maps to \`meta.system_requirements.required_vram\`, \`commands\` maps to \`ops[0].args.cmd\`).

\`\`\`json
{
  "type": string,
  "version": string,
  "ops": [
    {
      "id": string,
      "type": string,
      "args": {
        "cmd": string or string[] (<for provider == container only>),
        "gpu": boolean,
        "image": container image(<for provider == container only>) ,
        "expose": number (port number)
        "work_dir" : path (<for provider == container only>),
        "env" : { key : value }
        "entrypoint": "<entrypoint for provider == container only>",
        "required_vram" : number,
        "resources": [
          {
            "url": url string ,
            "type": string,
            "target": path
          }
        ]
      }
    }
  ],
  "meta": {
    "trigger": "<enum: dashboard | cli>",
    "system_requirements": {
      "required_vram": "<number: MB>"
    },
    "description": "<string: job description>",
    "owner": "<string: org/user>",
    "created_at": "<string: ISO timestamp>",
    // ...other metadata...
  }
}
\`\`\`
---

**Example 1 — Small LLM (Minimal Output for Default Config)**
 User: "run me the smallest open-source Llama model"
 Output:
\`\`\`json
{
  "providerName": "huggingface",
  "category": "text-generation",
  "modelName": "meta-llama/Llama-3.1-8B-Instruct",
  "params": "8B",
  "gpu": true,
  "vRAM_required": 16,
  "env": [
    { "key": "PARAMETER_SIZE", "value": "8B" },
    { "key": "MAX_MODEL_LEN", "value": "8192" }
  ],
  "notes": "Smallest Llama 3.1 instruction-tuned model. All inference defaults assumed.",
  "otherExtra": {
    "id": "llama31-8b-chat",
    "Description": "General-purpose text generation and chat."
  }
}
\`\`\`

**Example 2 — Private Model with Custom & Conditional ENV**
 User: "run me a DeepSeek 67B model with 2 GPUs, I need bfloat16 precision."
 Output:
\`\`\`json
{
  "providerName": "huggingface",
  "category": "text-generation",
  "modelName": "deepseek-ai/DeepSeek-LLM-67B-Chat",
  "params": "67B",
  "gpu": true,
  "requirementsGB": 24,
  "env": [
    { "key": "PARAMETER_SIZE", "value": "67B" },
    { "key": "MAX_MODEL_LEN", "value": "8192" },
    { "key": "TENSOR_PARALLEL_SIZE", "value": "2" },
    { "key": "DTYPE", "value": "bfloat16" }
  ],
  "notes": "DeepSeek 67B configured for 2 GPUs and bfloat16 precision.",
  "otherExtra": {
    "id": "deepseek-67b-bf16",
    "Description": "Large language model with specific precision and parallelism settings."
  }
}
\`\`\`

**Example 3 — Custom Container (Maximal ENV for Clarity)**
   User: "Deploy a TGI container for Mistral 7B. Use 98% memory utilization and allow streaming. with 1212 as access credential to secure model. also add a custom env as VINIT=NAGAR123"
   Output:
\`\`\`json
{
  "providerName": "container",
  "category": "text-generation",
  "modelName": "mistralai/Mistral-7B-Instruct-v0.2",
  "entrypoint": "text-generation-launcher",
  "image": "ghcr.io/huggingface/text-generation-inference:1.4",
  "params": "7B",
  "gpu": true,
  "requirementsGB": 16,
  "env": [
    { "key": "PARAMETER_SIZE", "value": "7B" },
    { "key": "MAX_MODEL_LEN", "value": "8192" },
    { "key": "MODEL_ID", "value": "mistralai/Mistral-7B-Instruct-v0.2" },
    { "key": "ENABLE_STREAMING", "value": "true" },
    { "key": "GPU_MEMORY_UTILIZATION", "value": "0.98" },
    { "key": "VINIT", "value": "NAGAR123" }
  ],
  "notes": "TGI container deployment for Mistral 7B with streaming and high GPU utilization enabled.",
  "commands": [
    "--model-id mistralai/Mistral-7B-Instruct-v0.2"
  ],
  "apiKey": "1212",
  "exposedPorts": 8000,
  "otherExtra": {
    "id": "mistral-tgi-container-stream",
    "Description": "TGI container with streaming enabled."
  }
}
\`\`\`

**Example 3A — Hugging Face TGI for Mistral 7B (Recommended)**
  User: "Deploy Mistral 7B for chat/instruct."
  Output:
\`\`\`json
{
  "providerName": "huggingface",
  "category": "text-generation",
  "modelName": "mistralai/Mistral-7B-Instruct-v0.2",
  "params": "7B",
  "gpu": true,
  "vRAM_required": 12,
  "env": [
    { "key": "PARAMETER_SIZE", "value": "7B" },
    { "key": "MAX_MODEL_LEN", "value": "8192" }
  ],
  "notes": "Runs on official TGI; platform auto-selects image and startup."
}
\`\`\`

 

**Example 3B — Ollama (API) for Mistral 7B**
  User: "Deploy Mistral 7B via Ollama API (no web UI)."
  Output:
\`\`\`json
{
  "providerName": "container",
  "category": "text-generation",
  "modelName": "mistral",
  "entrypoint": "/bin/bash",
  "image": "ollama/ollama:latest",
  "params": "7B",
  "gpu": true,
  "vRAM_required": 12,
  "env": [
    { "key": "OLLAMA_HOST", "value": "0.0.0.0:11434" },
    { "key": "OLLAMA_KEEP_ALIVE", "value": "5m" }
  ],
  "notes": "Runs Ollama server and pre-pulls the 'mistral' model from the registry.",
  "commands": [
    "-lc",
    "ollama serve & sleep 3 && ollama pull mistral && tail -f /dev/null"
  ],
  "exposedPorts": 11434,
  "otherExtra": {
    "id": "mistral-ollama",
    "Description": "Ollama REST API on 11434 with Mistral model preloaded."
  }
}
\`\`\`

**Example 4 — Custom Container (real image) with Resource**
   User: "run a docker image based on Hugging Face text-generation-inference, add env variable CREDENTIAL=vinit,
   and also load my resource from https://models.nosana.io/stable-diffusion/1.5 as /data/diffusion.
   Add command to start the vLLM server with model $MODEL and 2 GPUs.
   Entrypoint is /usr/local/bin/python."
   Output:
\`\`\`json
{
  "providerName": "container",
  "category": "text-generation",
  "modelName": "mistralai/Mistral-7B-Instruct-v0.2",
  "entrypoint": "/usr/local/bin/python",
  "image": "ghcr.io/huggingface/text-generation-inference:1.4",
  "params": "7B",
  "gpu": true,
  "vRAM_required": 16,
  "env": [
    { "key": "PARAMETER_SIZE", "value": "7B" },
    { "key": "MAX_MODEL_LEN", "value": "8192" },
    { "key": "GPU_MEMORY_UTILIZATION", "value": "0.95" },
    { "key": "TENSOR_PARALLEL_SIZE", "value": "2" },
    { "key": "CREDENTIAL", "value": "vinit" }
  ],
  "notes": "Using official Hugging Face TGI container for a Mistral 7B deployment. Requires 2 GPUs.",
  "commands": [
    "vllm_server --model mistralai/Mistral-7B-Instruct-v0.2 --tensor-parallel-size 2"
  ],
  "exposedPorts": 8000,
  "otherExtra": {
    "id": "mistral-tgi-container-tp2",
    "Description": "TGI container with custom resource and environment variable."
  },
  "resources": [
    {
      "type": "S3",
      "url": "https://models.nosana.io/stable-diffusion/1.5",
      "target": "/data/diffusion"
    }
  ]
}
\`\`\`

**Example 5 — Jupyter Notebook Service**
   User: "Deploy a Jupyter notebook server with GPU support and password authentication."
   Output:
\`\`\`json
{
  "providerName": "container",
  "category": "development-environment",
  "modelName": "jupyter/tensorflow-notebook",
  "entrypoint": "start-notebook.sh",
  "image": "jupyter/tensorflow-notebook:latest",
  "params": "N/A",
  "gpu": false,
  "env": [
    { "key": "JUPYTER_ENABLE_LAB", "value": "yes" },
    { "key": "GRANT_SUDO", "value": "yes" }
  ],
  "notes": "Jupyter notebook with TensorFlow and GPU support. Password will be set via token.",
  "commands": [
    "start-notebook.sh --NotebookApp.token='nosana123' --NotebookApp.allow_origin='*'"
  ],
  "apiKey": "nosana123",
  "exposedPorts": 8888,
  "otherExtra": {
    "id": "jupyter-gpu-notebook",
    "trigger": "dashboard",
    "Description": "Jupyter notebook with GPU access and authentication.",
    "work_dir": "/home/jovyan"
  }
}
\`\`\`

**Example 6 — Custom Python API Service**
   User: "Deploy a FastAPI application from my Docker image with custom env variables PORT=5000 and API_KEY=secret123."
   Output:
\`\`\`json
{
  "providerName": "container",
  "category": "generic-transformer",
  "modelName": "custom-fastapi-app",
  "entrypoint": "python",
  "image": "myorg/fastapi-app:v1.0",
  "params": "N/A",
  "gpu": false,
  "vRAM_required": 2,
  "env": [
    { "key": "PORT", "value": "5000" },
    { "key": "API_KEY", "value": "secret123" },
    { "key": "WORKERS", "value": "4" }
  ],
  "notes": "Custom FastAPI application with multi-worker setup.",
  "commands": [
    "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "4"
  ],
  "exposedPorts": 5000,
  "otherExtra": {
    "id": "custom-fastapi-service",
    "Description": "Custom API service with FastAPI framework.",
    "work_dir": "/app"
  }
}
\`\`\`

**Example 7 — vLLM Server for Large Model**
   User: "Deploy Qwen2.5-72B using vLLM with 4 GPUs, enable streaming, and set quantization to int4."
   Output:
\`\`\`json
{
  "providerName": "container",
  "category": "text-generation",
  "modelName": "Qwen/Qwen2.5-72B-Instruct",
  "entrypoint": "python",
  "image": "vllm/vllm-openai:latest",
  "params": "72B",
  "gpu": true,
  "vRAM_required": 48,
  "env": [
    { "key": "PARAMETER_SIZE", "value": "72B" },
    { "key": "MAX_MODEL_LEN", "value": "8192" },
    { "key": "TENSOR_PARALLEL_SIZE", "value": "4" },
    { "key": "QUANTIZATION", "value": "int4" },
    { "key": "ENABLE_STREAMING", "value": "true" },
    { "key": "MODEL_ID", "value": "Qwen/Qwen2.5-72B-Instruct" }
  ],
  "notes": "vLLM deployment for Qwen2.5-72B with INT4 quantization across 4 GPUs. Streaming enabled.",
  "commands": [
    "-m", "vllm.entrypoints.openai.api_server",
    "--model", "Qwen/Qwen2.5-72B-Instruct",
    "--tensor-parallel-size", "4",
    "--quantization", "awq",
    "--max-model-len", "8192"
  ],
  "exposedPorts": 8000,
  "otherExtra": {
    "id": "qwen72b-vllm-int4",
    "Description": "Large language model with quantization for efficient inference."
  }
}
\`\`\`

**Example 8 — Stable Diffusion XL with Custom Checkpoint**
   User: "Deploy SDXL with a custom checkpoint from URL, expose on port 7860, add authentication."
   Output:
\`\`\`json
{
  "providerName": "container",
  "category": "text-to-image",
  "modelName": "stabilityai/stable-diffusion-xl-base-1.0",
  "entrypoint": "python",
  "image": "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a",
  "params": "N/A",
  "gpu": true,
  "vRAM_required": 16,
  "env": [
    { "key": "MODEL_ID", "value": "stabilityai/stable-diffusion-xl-base-1.0" },
    { "key": "MAX_MODEL_LEN", "value": "8192" }
  ],
  "notes": "Stable Diffusion XL with custom checkpoint loaded from remote URL.",
  "commands": [
    "manage.py", "start", "--model-id", "stabilityai/stable-diffusion-xl-base-1.0",
    "--framework", "diffusers", "--task", "text-to-image", "--port", "7860"
  ],
  "apiKey": "sdxl_secret_key",
  "exposedPorts": 7860,
  "otherExtra": {
    "id": "sdxl-custom-checkpoint",
    "Description": "SDXL image generation with custom model weights."
  },
  "resources": [
    {
      "type": "S3",
      "url": "https://models.nosana.io/sdxl/custom-checkpoint.safetensors",
      "target": "/app/models/checkpoints"
    }
  ]
}
\`\`\`

example Models: 
example Models: some model example there could be much more based on demand - 
| Family  | Common Models                                                              |
| ------- | -------------------------------------------------------------------------- |
| Qwen    | qwen1.5-0.5B, qwen1.5-1.8B, qwen1.5-7B, qwen1.5-14B, qwen1.5-72B           |
| Qwen2   | qwen2-1.5B, qwen2-7B, qwen2-72B, qwen2-110B                                |
| Qwen2.5 | qwen2.5-0.5B, qwen2.5-3B, qwen2.5-7B, qwen2.5-14B, qwen2.5-72B             |

| Family         | Common Models                                                        |
| -------------- | -------------------------------------------------------------------- |
| DeepSeek       | deepseek-1.3B, deepseek-7B, deepseek-33B, deepseek-67B              |
| DeepSeek-Coder | deepseek-coder-1.3B, deepseek-coder-6.7B, deepseek-coder-33B        |
| DeepSeek-V2    | deepseek-v2-lite, deepseek-v2-16B, deepseek-v2-70B                  |

| Family    | Common Models                                                            |
| --------- | ------------------------------------------------------------------------ |
| Mistral   | mistral-7B                                                               |
| Mixtral   | mixtral-8x7B, mixtral-8x22B (Mixture-of-Experts)                         |
| Codestral | codestral-22B (code-focused)                                             |

| Family  | Common Models                                                              |
| ------- | -------------------------------------------------------------------------- |
| LLaMA   | llama-1-7B, llama-1-13B, llama-1-65B                                       |
| LLaMA 2 | llama-2-7B, llama-2-13B, llama-2-70B                                       |
| LLaMA 3 | llama-3-8B, llama-3-70B, llama-3.1-8B, llama-3.1-405B                      |

| Org                  | Example Models                                                 |
| -------------------- | -------------------------------------------------------------- |
| Google Gemma         | gemma-2B, gemma-7B, gemma-27B                                 |
| Anthropic Claude     | claude-1, claude-2, claude-3-sonnet, claude-3.5-sonnet        |
| OpenAI GPT           | gpt-3.5, gpt-4, gpt-4-turbo, gpt-5                            |
| Mosaic MPT           | mpt-7B, mpt-30B                                               |
| Falcon (TII)         | falcon-7B, falcon-40B, falcon-180B                            |
| Yi (01.AI)           | yi-6B, yi-34B, yi-1.5-9B, yi-1.5-34B                          |
| Command (Cohere)     | command-r, command-r-plus                                     |




SOME of the famous hugging face organization... there are many more ... 
- huggingface
meta-llama | huggingface | qwen | qwen2 | | facebook | nvidia | google | stabilityai | openai | microsoft | mistralai | black-forest-labs | tencent | ibm-granite | cohere-labs | baidu | jina-ai | deepseek-ai |  togethercomputer | salesforce | BAAI | zai-org | google-bert | google-t5 | facebookAi  | Wan-Ai | distilbert | apple | mixedbread | deephat | katenemo | includsionAI | moonshotai | unsloth ....

Now process this user request:
if query is a defination and type is container then it doesn't mean provider is container ,
if json config contin image as hugging face infere related model with hugging face type model then consider provider name as hugging face only and not container
======
${refinedQuery}
${marketDetails ? `Market: ${JSON.stringify(marketDetails, null, 2)}` : ""}
${modelName ? `Model: ${modelName}` : ""}
======

- also this DATA will be used directly to create the job definition: so make sure you will dont create mock config here which dont make any sense in production environmen

CRITICAL CONSTRAINT: The generated JSON must be a production-ready, logically coherent configuration that is immediately executable by the inference engine (vLLM/TGI). DO NOT generate mock, placeholder, or contradictory settings. The entire configuration must be valid for a real-world job deployment.
`;
}


export function suggest_model_market_prompt(requirements: string, MARKETS: Record<string, any>): string {
  const marketList = Object.entries(MARKETS)
    .map(([slug, m]) => {
      return `- ${slug}: ${m.vram_gb}GB VRAM, $${m.estimated_price_usd_per_hour}/hr, address: ${m.address}`
    })
    .join("\n")

  return `
You are an expert GPU + AI model recommender.
The user will provide requirements for AI inference or training. You must recommend the most suitable models and GPU markets.
- Make sure you only and only recommend hugging face model with full name *org/modelName*

---
## User Requirements
${requirements}

---
## GPU Market Data
Here are the available GPU markets with their capabilities:
${marketList}

---
## TASK

Analyze the user's requirements and respond in **strict JSON format** following this schema:
{
  "model": [
    { "name": string, "reason": string , "recommandation_score" : number}
  ],
  "market": [
    { "name": string, "reason": string, "price": string, "address": string , "recommandation_score" : number }
  ]
}

### Rules:
1. The user might mention:
   - Only **model** requirements (e.g., "best 7B model for text generation") - only hugging face model with full name *org/modelName*
   - Only **GPU/market** requirements (e.g., "best GPU under $0.05/hr with 8GB VRAM")
   - Or both (e.g., "want best cheap GPU for running Mistral-7B")

3. Evaluate markets based on:
   - VRAM requirements (high VRAM = better for larger models)
   - Price efficiency (cheaper for small models, high VRAM worth more for large)
   - Practical deployment (availability, balance between price and VRAM)

4. Evaluate models based on:
  - Size (e.g., 7B, 13B, 70B)
  - Purpose (chat, coding, general tasks)
  - Efficiency vs accuracy tradeoffs
  - Compatibility with the available VRAM markets above
  - performance speed , cost and so many such parameters
5. Keep reasons **clear, and factual , contains pros and cons and all**:

---
## OUTPUT EXAMPLE

{
  "model": [
    { "name": "mistralai/Mistral-7B-Instruct-v0.2", "reason": "Efficient chat model that runs within 8GB VRAM GPUs....." , recommandation_score : 9},
    { "name": "meta-llama/Llama-3.1-8B-Instruct", "reason": "High-quality general model with balanced performance...." , recommandation_score: x},
    { "name": "microsoft/Phi-3-mini-4k-instruct", "reason": "Lightweight model suitable for cheaper markets" , recommandation_score : x}...
  ],
  "market": [
    { "name": "nvidia-4060", "reason": "8GB VRAM ideal for 7B models", "price": "0.064", "address": "47LQHZwT7gfVoBDYnRYhsYv6vKk8a1oW3Y3SdHAp1gTr" , recommandation_score : 10},
    { "name": "nvidia-3060", "reason": "Budget GPU for lightweight inference", "price": "0.048", "address": "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq" , recommandation_score: 8},
    { "name": "nvidia-4090", "reason": "High VRAM for 13B+ models", "price": "0.120", "address": "EXAMPLEADDR..." , recommandation_score : 7 }...
  ]
}


SOME of the famous hugging face organization... there are many more ... 
- huggingface
meta-llama | huggingface | qwen | qwen2 | | facebook | nvidia | google | stabilityai | openai | microsoft | mistralai | black-forest-labs | tencent | ibm-granite | cohere-labs | baidu | jina-ai | deepseek-ai |  togethercomputer | salesforce | BAAI | zai-org | google-bert | google-t5 | facebookAi  | Wan-Ai | distilbert | apple | mixedbread | deephat | katenemo | includsionAI | moonshotai | unsloth ....


# IMPORTANT
-  based on condition you have to figure our performance and all , first do reasoning find verious case like user task is this or requirement is this , here this is required vs this is not required and based on so many assumption and all finally get to a point where show user the best choices with a detailed description like why did you choose this or that

---
Now analyze the input and output valid JSON only.
`
}




export function getResolverPromptV2(
  refinedQuery: string,
  { marketDetails, modelName }: { marketDetails?: MarketInfo; modelName?: string }
) {
  return `
You are an expert AI JSON Definition Generator.
Your job is to analyze the user’s request and generate a **production-ready JSON definition**
that aligns with the provided schema. This JSON will be used directly to launch or configure
real services (LLMs, APIs, apps, etc.). No placeholders. No fake configs.

Your decisions must be based on:
1. The user query (requirements)
2. The given market details
3. The provided or inferred model name

==========
USER INPUT CONTEXT
${refinedQuery}
${marketDetails ? `Market: ${JSON.stringify(marketDetails, null, 2)}` : ""}
${modelName ? `Model: ${modelName}` : ""}
==========

### OBJECTIVE
Return a **valid JSON** definition that can be used as input for a production deployment job.
The JSON must:
- Be **logically coherent**, **runnable**, and **fully compatible** with real engines (vLLM, TGI, Ollama, etc.).
- Never include placeholders, mock data, or contradictions.
- Follow the schema definition already provided to you.

### CORE RULES
- You must identify the correct **providerName** based on intent:
  * If user mentions Docker image, container name, or service → providerName = "container"
  * If user wants to host a Hugging Face model or gives a HF model ID → providerName = "huggingface"
  * If user just says “run model X” without image → assume providerName = "huggingface"
- The model name can appear in fuzzy form (e.g., “deepseek 3B”, “deepseek-3b-model”, “DeepSeek-3B Chat”).
  Normalize and match it to the closest real model on Hugging Face or Ollama registry.
- If user mentions vLLM, TGI, or Ollama image → set providerName = "container"
  and fill required fields: \`image\`, \`entrypoint\`, \`commands\`, and \`env\`.
- If image corresponds to a Hugging Face inference service (e.g., “ghcr.io/huggingface/text-generation-inference”) → keep providerName = "huggingface".

### PROVIDER LOGIC
- For Hugging Face: omit “image”, “entrypoint”, and “commands” — handled automatically.
- For Container: must provide valid image, env, entrypoint, exposedPorts, and commands.
- Always prefer real images like:
  * vLLM: "vllm/vllm-openai:latest"
  * TGI: "ghcr.io/huggingface/text-generation-inference:1.4"
  * Ollama: "ollama/ollama:latest"
  * Jupyter: "jupyter/tensorflow-notebook:latest"
  * OneClickLLM: "docker.io/hoomanhq/oneclickllm:ollama01"

### ENVIRONMENT LOGIC
- env must be an array of { "key": string, "value": string }.
- Include only real, relevant keys (no placeholders).
- Required (for text models):
  * PARAMETER_SIZE
  * MAX_MODEL_LEN (default "8192")
  * MODEL_ID (for container provider)
- Optional (add only if mentioned or valid):
  * ENABLE_STREAMING, QUANTIZATION, GPU_MEMORY_UTILIZATION, SWAP_SPACE, DTYPE, API_KEY, etc.
- Do not output invalid values ("NAN", "unknown", "false", "0.9", etc.).
- Estimate VRAM requirements realistically: required_vram = (params * 2) + 2 GB.

### PROVIDER AUTO-SELECTION
- If user says “run mistral with vllm image” → providerName = "container"
- If user says “run mistral model” without image → providerName = "huggingface"
- If user says “host any model” and provides no detail → choose smallest open LLM (e.g., Llama 3.1 8B)
- If user gives custom app (FastAPI, Jupyter, etc.) → providerName = "container"

### ENV & COMMAND CREATION
- For container → env, image, entrypoint, and command must align.
- For huggingface → env only, no container config.
- Example:
  * Ollama container: expose 11434, entrypoint="/bin/bash", cmd starts server and pulls model.
  * vLLM container: python entrypoint with openai API mode, port 8000.
  * Jupyter: start-notebook.sh, port 8888.

### CATEGORY MAPPING
- text-generation → for chat/LLM tasks.
- text-to-image → for diffusion/stable diffusion.
- development-environment → for Jupyter/IDE-type containers.
- generic-transformer → for FastAPI/custom logic apps.

### VALIDATION RULES
- Always output **valid JSON** only — no markdown, comments, or explanations.
- Output must be consistent with the schema and fully deployable.
- If unsure of a field, omit it (never fake it).
- If provider is “container”, you must set:
  image, entrypoint, commands, exposedPorts, env (non-empty).
- If provider is “huggingface”, omit image and container fields.

### CRITICAL CONSTRAINT
Your output will be directly used to generate a real job definition.
Therefore:
- Do not invent fake URLs or commands.
- Do not leave required fields undefined.
- Do not use template placeholders.
- Only output JSON — no other text.

### ADDITIONAL LOGIC
- Convert fuzzy model references (like “Deepseek 3B model”) into valid identifiers (deepseek-ai/DeepSeek-LLM-3B).
- Respect VRAM estimation and GPU constraints.
- Keep env, entrypoint, and image consistent for the given model.

==========
Now process the user query and generate the final JSON definition.
`;
}
