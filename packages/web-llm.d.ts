// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// @mlc-ai/web-llm@0.2.84 declares types at lib/index.d.ts but the published
// install often only includes .d.ts.map files (TS7016). Remap via tsconfig
// paths to this slim surface covering APIs Br1zzCAD imports.
export interface InitProgressReport {
    progress: number;
    timeElapsed: number;
    text: string;
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatCompletionMessageParam {
    role: ChatRole;
    content: string;
}

export interface ChatCompletionRequest {
    messages: ChatCompletionMessageParam[];
    temperature?: number;
    response_format?: { type: string };
}

export interface ChatCompletionMessage {
    role: ChatRole;
    content: string | null;
}

export interface ChatCompletionChoice {
    message?: ChatCompletionMessage;
}

export interface ChatCompletion {
    choices: ChatCompletionChoice[];
}

export interface MLCEngineInterface {
    chat: {
        completions: {
            create(request: ChatCompletionRequest): Promise<ChatCompletion>;
        };
    };
}

export type MLCEngine = MLCEngineInterface;

export interface MLCEngineConfig {
    initProgressCallback?: (report: InitProgressReport) => void;
}

export function CreateMLCEngine(
    modelId: string,
    engineConfig?: MLCEngineConfig,
): Promise<MLCEngine>;
