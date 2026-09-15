// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { WorkerLike } from "../src/rpc/client";
import type { RpcRequest, RpcResponse } from "../src/rpc/protocol";

/**
 * In-memory `WorkerLike` for tests - no real `Worker`, no `self`, no
 * `new URL(..., import.meta.url)` (rstest's happy-dom environment can't
 * meaningfully exercise either). Runs a supplied `handle` function with a
 * configurable delay, so a test can deliberately make an *earlier* request
 * resolve *after* a *later* one, exercising the same out-of-order-response
 * scenario a real worker under load would produce.
 */
export class MockWorker implements WorkerLike {
    private listeners: ((event: MessageEvent<RpcResponse>) => void)[] = [];

    constructor(
        private readonly handle: (request: RpcRequest) => RpcResponse,
        private readonly delayMs: number | ((request: RpcRequest) => number) = 0,
    ) {}

    postMessage(message: unknown): void {
        const request = message as RpcRequest;
        const delay = typeof this.delayMs === "function" ? this.delayMs(request) : this.delayMs;
        const respond = () => {
            const response = this.handle(request);
            for (const listener of this.listeners) listener({ data: response } as MessageEvent<RpcResponse>);
        };
        if (delay > 0) setTimeout(respond, delay);
        else queueMicrotask(respond);
    }

    addEventListener(_type: "message", listener: (event: MessageEvent<RpcResponse>) => void): void {
        this.listeners.push(listener);
    }

    removeEventListener(_type: "message", listener: (event: MessageEvent<RpcResponse>) => void): void {
        this.listeners = this.listeners.filter((l) => l !== listener);
    }

    terminate(): void {
        this.listeners = [];
    }
}
