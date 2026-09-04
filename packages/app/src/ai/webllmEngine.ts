// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { InitProgressReport, MLCEngine } from "@mlc-ai/web-llm";

const MODEL_ID = "Qwen2.5-3B-Instruct-q4f16_1-MLC";

let enginePromise: Promise<MLCEngine> | null = null;
let engineReady = false;
const progressListeners = new Set<(report: InitProgressReport) => void>();

/** True once the WebLLM engine has finished loading (model stays warm in-memory). */
export function isWebLLMReady(): boolean {
    return engineReady;
}

/** Returns a user-facing error message if WebGPU cannot run, otherwise null. */
export function getWebGPUBlocker(): string | null {
    if (
        typeof navigator === "undefined" ||
        !("gpu" in navigator) ||
        !(navigator as Navigator & { gpu?: unknown }).gpu
    ) {
        return "WebGPU is not available. Use Chrome or Edge 113+ (or another browser with WebGPU enabled).";
    }
    return null;
}

function wrapEngineError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes("webgpu") || lower.includes("gpu")) {
        return new Error(
            `WebLLM failed to start (GPU): ${message}. Check that WebGPU is enabled and the GPU is not blocked.`,
        );
    }
    return new Error(
        `Failed to load the local AI model: ${message}. You can retry — the download will resume from cache if possible.`,
    );
}

/** Lazily creates (once) and returns the local WebLLM engine, running entirely
 * in the browser via WebGPU - no network calls once the model is cached.
 * Failed loads clear the cached promise so the next call can retry. */
export function getWebLLMEngine(onProgress?: (report: InitProgressReport) => void): Promise<MLCEngine> {
    const blocker = getWebGPUBlocker();
    if (blocker) {
        return Promise.reject(new Error(blocker));
    }

    if (onProgress) {
        progressListeners.add(onProgress);
    }

    if (!enginePromise) {
        engineReady = false;
        enginePromise = (async () => {
            try {
                const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
                const engine = await CreateMLCEngine(MODEL_ID, {
                    initProgressCallback: (report: InitProgressReport) => {
                        for (const listener of progressListeners) {
                            listener(report);
                        }
                    },
                });
                engineReady = true;
                return engine;
            } catch (error) {
                enginePromise = null;
                engineReady = false;
                throw wrapEngineError(error);
            } finally {
                progressListeners.clear();
            }
        })();
    }

    return enginePromise.finally(() => {
        if (onProgress) {
            progressListeners.delete(onProgress);
        }
    });
}

export async function askJSON(
    systemPrompt: string,
    userPrompt: string,
    onProgress?: (report: InitProgressReport) => void,
): Promise<string> {
    const engine = await getWebLLMEngine(onProgress);
    const reply = await engine.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
    });
    return reply.choices[0]?.message?.content ?? "";
}
