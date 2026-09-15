// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDisposable, Id } from "@chili3d/core";
import type { RpcRequest, RpcResponse } from "./protocol";

/** Minimal surface of `Worker` this client needs - lets a test substitute
 * an in-memory `MockWorker` (see `test/mockWorker.ts`) without touching the
 * real `Worker` global or `new URL(..., import.meta.url)`, neither of which
 * rstest's happy-dom environment can meaningfully exercise. */
export interface WorkerLike {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    addEventListener(type: "message", listener: (event: MessageEvent<RpcResponse>) => void): void;
    removeEventListener(type: "message", listener: (event: MessageEvent<RpcResponse>) => void): void;
    terminate(): void;
}

interface Pending {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
}

/**
 * Main-thread side of the RPC bridge: sends `{id, action, payload}`,
 * resolves/rejects the matching caller's promise when a response with that
 * `id` arrives. A response whose `id` has no pending entry (already
 * resolved, or explicitly discarded via `discard()`) is silently ignored,
 * not an error - that's the hook a caller like `SketchSolveSession` uses to
 * implement "only the latest result wins" staleness handling.
 */
export class RpcClient implements IDisposable {
    private readonly pending = new Map<string, Pending>();

    private readonly onMessage = (event: MessageEvent<RpcResponse>) => {
        const response = event.data;
        const entry = this.pending.get(response.id);
        if (!entry) return;
        this.pending.delete(response.id);
        if (response.ok) entry.resolve(response.result);
        else entry.reject(new Error(response.error));
    };

    constructor(private readonly worker: WorkerLike) {
        this.worker.addEventListener("message", this.onMessage);
    }

    /** Dispatches a request and returns its `id` alongside the promise that
     * settles when the matching response arrives - callers that need to
     * compare "is this still the most recent request I sent" (see
     * `SketchSolveSession`) need the `id` itself, not just the promise. */
    request<TPayload, TResult>(
        action: string,
        payload: TPayload,
        transfer?: Transferable[],
    ): { id: string; result: Promise<TResult> } {
        const id = Id.generate();
        const message: RpcRequest<string, TPayload> = { id, action, payload };
        const result = new Promise<TResult>((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
            this.worker.postMessage(message, transfer ?? []);
        });
        return { id, result };
    }

    /** Drops a specific in-flight request without waiting for (and without
     * ever resolving/rejecting) its response - a late response for a
     * discarded id is simply ignored by `onMessage` above. */
    discard(id: string): void {
        this.pending.delete(id);
    }

    dispose(): void {
        this.worker.removeEventListener("message", this.onMessage);
        this.pending.clear();
        this.worker.terminate();
    }
}
