// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { InitProgressReport, MLCEngine } from "@mlc-ai/web-llm";

const MODEL_ID = "Qwen2.5-3B-Instruct-q4f16_1-MLC";

let enginePromise: Promise<MLCEngine> | null = null;

/** Lazily creates (once) and returns the local WebLLM engine, running entirely
 * in the browser via WebGPU - no network calls once the model is cached. */
export function getWebLLMEngine(onProgress?: (report: InitProgressReport) => void): Promise<MLCEngine> {
    if (!enginePromise) {
        enginePromise = import("@mlc-ai/web-llm").then(({ CreateMLCEngine }) =>
            CreateMLCEngine(MODEL_ID, {
                initProgressCallback: onProgress,
            }),
        );
    }
    return enginePromise;
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
