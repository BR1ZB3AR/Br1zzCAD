// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Ambient typings for @mlc-ai/web-llm.
 *
 * Published 0.2.x tarball claims lib/index.d.ts but ships only maps.
 * Minimal surface declaration for APIs Br1zzCAD uses.
 */
declare module "@mlc-ai/web-llm" {
    export interface InitProgressReport {
        progress: number;
        timeElapsed: number;
        text: string;
    }

    export type ChatCompletionRole = "system" | "user" | "assistant" | "tool";

    export interface ChatCompletionMessageParam {
        role: ChatCompletionRole;
        content: string | null;
    }

    export interface ChatCompletionRequest {
        messages: ChatCompletionMessageParam[];
        temperature?: number | null;
        response_format?: { type: string; [key: string]: unknown };
        [key: string]: unknown;
    }

    export interface ChatCompletionMessage {
        role: ChatCompletionRole;
        content: string | null;
    }

    export interface ChatCompletionChoice {
        index?: number;
        message?: ChatCompletionMessage;
        finish_reason?: string | null;
    }

    export interface ChatCompletion {
        choices: ChatCompletionChoice[];
    }

    export interface MLCEngineConfig {
        initProgressCallback?: (report: InitProgressReport) => void;
        [key: string]: unknown;
    }

    export interface MLCEngine {
        chat: {
            completions: {
                create(request: ChatCompletionRequest): Promise<ChatCompletion>;
            };
        };
    }

    export function CreateMLCEngine(
        modelId: string,
        engineConfig?: MLCEngineConfig,
        chatOpts?: unknown,
    ): Promise<MLCEngine>;
}
