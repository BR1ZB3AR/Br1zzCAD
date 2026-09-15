// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { RpcHandler, RpcRequest, RpcResponse } from "./protocol";

/**
 * Worker-side dispatch table: register a named action once, then hand every
 * incoming `RpcRequest` to `handle()` to get back the `RpcResponse` to post.
 * Deliberately has no reference to `self`/`postMessage`/`onmessage` - the
 * actual worker entry file (`*.worker.ts`) owns that wiring and is the only
 * place that needs the worker-global ambient shim, keeping this class (and
 * its tests) plain, environment-agnostic TS.
 */
export class RpcHandlerRegistry {
    private readonly handlers = new Map<string, RpcHandler>();

    register<TPayload, TResult>(action: string, handler: RpcHandler<TPayload, TResult>): void {
        this.handlers.set(action, handler as RpcHandler);
    }

    /** Never throws - a handler that throws (or references an unknown
     * action) becomes an `{ok: false}` response instead of crashing the
     * worker, per the caller's own error-handling contract. */
    handle(request: RpcRequest): RpcResponse {
        const handler = this.handlers.get(request.action);
        if (!handler) {
            return { id: request.id, ok: false, error: `Unknown action: ${request.action}` };
        }
        try {
            return { id: request.id, ok: true, result: handler(request.payload) };
        } catch (e) {
            return { id: request.id, ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
}
