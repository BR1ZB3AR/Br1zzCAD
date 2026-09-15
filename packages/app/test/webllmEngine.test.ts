// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { CreateMLCEngine, type MLCEngine } from "@mlc-ai/web-llm";
import { expect, rs, test } from "@rstest/core";
import { getWebLLMEngine } from "../src/ai/webllmEngine";

rs.mock("@mlc-ai/web-llm", () => ({ CreateMLCEngine: rs.fn() }));

test("retries failed initialization and shares the successful engine", async () => {
    const engine = {} as MLCEngine;
    const failure = new Error("Model download failed");
    const createEngine = rs.mocked(CreateMLCEngine);
    createEngine.mockRejectedValueOnce(failure).mockResolvedValueOnce(engine);

    const firstAttempt = getWebLLMEngine();
    expect(getWebLLMEngine()).toBe(firstAttempt);
    await expect(firstAttempt).rejects.toBe(failure);
    expect(createEngine).toHaveBeenCalledTimes(1);

    const onProgress = rs.fn();
    const retry = getWebLLMEngine(onProgress);
    expect(getWebLLMEngine()).toBe(retry);
    await expect(retry).resolves.toBe(engine);
    expect(createEngine).toHaveBeenCalledTimes(2);
    expect(createEngine).toHaveBeenLastCalledWith("Qwen2.5-3B-Instruct-q4f16_1-MLC", {
        initProgressCallback: onProgress,
    });

    await expect(getWebLLMEngine()).resolves.toBe(engine);
    expect(createEngine).toHaveBeenCalledTimes(2);
});
