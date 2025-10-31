"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/store/wallet.store";
import { createJob } from "@/lib/nosana/createJob";
import { extendJob } from "@/lib/nosana/extendjob";
import { stopJob } from "@/lib/nosana/stopJob";
import { PublicKey } from "@solana/web3.js";
import { validateJobDefinition } from "@nosana/sdk";

const gpuList = [
  { name: "NVIDIA 3060", key: "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq", price: "$0.048/h" },
  { name: "NVIDIA 4060", key: "47LQHZwT7gfVoBDYnRYhsYv6vKk8a1oW3Y3SdHAp1gTr", price: "$0.064/h" },
  { name: "NVIDIA 5070", key: "5eX3kWkrcbwejEc1svbfP4F7NKYjtPDuyU5KnV1hUBKg", price: "$0.240/h" },
  { name: "NVIDIA H100", key: "Crop49jpc7prcgAcS82WbWyGHwbN5GgDym3uFbxxCTZg", price: "$1.500/h" },
];

export default function DummyGpuFrontend() {
    const { wallet, connectWallet, isConnected } = useWalletStore(); // Add isConnected

    const [selectedGpu, setSelectedGpu] = useState<string | null>(null);
    const [minutes, setMinutes] = useState<number>(10);
    const [jobId, setJobId] = useState<string>("");
    const [extendMinutes, setExtendMinutes] = useState<number>(10);
    const [loading, setLoading] = useState(false);
    const [jobs, setJobs] = useState<any[]>([]);

    useEffect(() => {
      const { checkPhantom, verifyConnection } = useWalletStore.getState();
      checkPhantom();
      // optional delayed recheck
      setTimeout(verifyConnection, 1000);
    }, []);

  // ------------------- FIXED WALLET CHECK -------------------
  async function ensureWallet() {
    try {
      // Check if wallet is already connected in state
      if (!wallet || !isConnected) {
        console.log("🔄 Wallet not connected, attempting to connect...");
        await connectWallet();

        // Wait a bit for state to update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check again after connection attempt
        const currentState = useWalletStore.getState();
        if (!currentState.wallet) {
          throw new Error("Wallet connection failed or was rejected");
        }

        console.log("✅ Wallet connected successfully");
      }
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      throw new Error(`Wallet connection failed: ${err.message}`);
    }
  }

  // ------------------- JOB FETCH -------------------
  async function fetchJobs() {
    try {
      const res = await fetch("/api/jobs?limit=10&order=desc");
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) setJobs(data.data);
    } catch (err) {
      console.error("Fetch jobs failed:", err);
    }
  }

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ------------------- JOB CREATION -------------------
  async function handleRunJob() {
    try {
      await ensureWallet();
      if (!selectedGpu) return alert("Select a GPU first.");

      const marketKey = new PublicKey(selectedGpu);
      const jobTimeout = minutes;

      const jobFlow = {
        ops: [
          {
            id: "Qwen1.5b",
            args: {
              cmd: [
                "--model",
                "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
                "--served-model-name",
                "DeepSeek-R1-Distill-Qwen-1.5B",
                "--port",
                "9000",
                "--max-model-len",
                "30000",
              ],
              gpu: true,
              image: "docker.io/vllm/vllm-openai:v0.10.2",
              expose: [
                {
                  port: 9000,
                  health_checks: [
                    {
                      body: '{"model":"DeepSeek-R1-Distill-Qwen-1.5B","messages":[{"role":"user","content":"Respond with a single word: Ready"}],"stream":false}',
                      path: "/v1/chat/completions",
                      type: "http",
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      continuous: false,
                      expected_status: 200,
                    },
                  ],
                },
              ],
            },
            type: "container/run",
          },
        ],
        meta: {
          trigger: "dashboard",
          system_requirements: {
            required_cuda: ["12.8", "12.9"],
            required_vram: 6,
          },
        },
        type: "container",
        version: "0.1",
      };

      const r = validateJobDefinition(jobFlow);
      if (!r.success) throw new Error("Invalid Job Definition");

      setLoading(true);
      await createJob(jobFlow, marketKey, jobTimeout);
      await fetchJobs();
      alert("✅ Job created successfully");
    } catch (err: any) {
      console.error(err);
      alert("❌ " + (err.message || "Error creating job"));
    } finally {
      setLoading(false);
    }
  }

  // ------------------- EXTEND JOB -------------------
  async function handleExtendJob() {
    try {
      await ensureWallet();
      if (!jobId.trim()) return alert("Enter a valid Job ID.");
      setLoading(true);
      await extendJob(jobId.trim(), extendMinutes);
      await fetchJobs();
      alert("✅ Job extended");
    } catch (err: any) {
      console.error(err);
      alert("❌ " + (err.message || "Error extending job"));
    } finally {
      setLoading(false);
    }
  }

  // ------------------- STOP JOB -------------------
  async function handleStopJob() {
    try {
      await ensureWallet();
      if (!jobId.trim()) return alert("Enter a valid Job ID.");
      setLoading(true);
      await stopJob(jobId.trim());
      await fetchJobs();
      alert("🛑 Job stopped");
    } catch (err: any) {
      console.error(err);
      alert("❌ " + (err.message || "Error stopping job"));
    } finally {
      setLoading(false);
    }
  }

  // ------------------- UI -------------------
  return (
    <div className="mx-auto my-10 p-6 bg-zinc-900 text-gray-200 rounded-lg shadow-lg space-y-8 border border-zinc-800">
      <h2 className="text-3xl font-bold text-center mb-2">Nosana GPU Control Panel</h2>

      {/* Wallet Status Display */}
      <div className="text-center">
        {wallet ? (
          <div className="text-green-400 text-sm">
            ✅ Connected: {wallet.slice(0, 6)}...{wallet.slice(-6)}
          </div>
        ) : (
          <div className="text-yellow-400 text-sm">
            🔄 Wallet not connected
          </div>
        )}
      </div>

      {/* GPU SELECT + CREATE JOB */}
      <section className="space-y-4 border-b border-zinc-800 pb-4">
        <h4 className="text-lg font-semibold">Create Job</h4>
        <div className="flex flex-wrap justify-center gap-3">
          {gpuList.map((gpu) => (
            <button
              key={gpu.key}
              className={`px-4 py-2 rounded-md ${selectedGpu === gpu.key
                ? "bg-blue-600"
                : "bg-zinc-700 hover:bg-zinc-600"
                }`}
              onClick={() => setSelectedGpu(gpu.key)}
            >
              {gpu.name} <span className="text-gray-400 ml-1">{gpu.price}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <label>Run Time (minutes)</label>
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-24 text-center bg-zinc-800 border border-zinc-600 rounded"
          />
          <button
            onClick={handleRunJob}
            disabled={!selectedGpu || loading}
            className="bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-md font-semibold"
          >
            {loading ? "Processing..." : "Create Job"}
          </button>
        </div>
      </section>

      {/* JOB CONTROLS */}
      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h4 className="text-lg font-semibold">Manage Existing Job</h4>
        <input
          type="text"
          placeholder="Enter Job ID"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-sm"
        />
        <div className="flex gap-3 justify-center">
          <input
            type="number"
            value={extendMinutes}
            onChange={(e) => setExtendMinutes(Number(e.target.value))}
            min={1}
            className="w-20 text-center bg-zinc-800 border border-zinc-600 rounded"
          />
          <button
            onClick={handleExtendJob}
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 px-5 py-2 rounded-md font-semibold"
          >
            {loading ? "Extending..." : "Extend Job"}
          </button>
          <button
            onClick={handleStopJob}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 px-5 py-2 rounded-md font-semibold"
          >
            {loading ? "Stopping..." : "Stop Job"}
          </button>
        </div>
      </section>

      {/* JOB TABLE */}
      <section className="space-y-3">
        <h4 className="text-lg font-semibold">Jobs from Database</h4>
        {jobs.length === 0 ? (
          <p className="text-gray-400 text-center">No jobs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border border-zinc-800">
              <thead className="bg-zinc-800 text-gray-400">
                <tr>
                  <th className="px-3 py-2">Job ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Node</th>
                  <th className="px-3 py-2">Logs</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jobId} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-mono text-xs">{job.jobId}</td>
                    <td className="px-3 py-2">{job.status}</td>
                    <td className="px-3 py-2 truncate">{job.market}</td>
                    <td className="px-3 py-2 truncate">{job.node}</td>
                    <td className="px-3 py-2 text-xs text-green-400 font-mono">
                      {job.logs?.length ? (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {job.logs.slice(0, 50).map((l: string, i: number) => (
                            <div key={i}>› {l}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">No logs</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}