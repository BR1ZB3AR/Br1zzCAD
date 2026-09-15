// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDisposable } from "@chili3d/core";
import { RpcClient, type WorkerLike } from "../rpc/client";
import type { SketchSolveWorkerPayload, SketchSolveWorkerResult } from "./sketchSolverWorkerApi";

const SOLVE_ACTION = "solveSketch";

/**
 * Main-thread wrapper around `RpcClient` implementing "only the latest
 * result wins": if a newer `solve()` call is dispatched before an older
 * one's worker response comes back, the older call's result (success OR
 * failure) is discarded - it resolves `undefined` rather than being acted
 * on or thrown. This is the intended behavior when positions are changing
 * faster than the worker can keep up (e.g. a future drag gesture); true
 * mid-solve cancellation isn't possible (the LM loop inside `solve()` is a
 * plain synchronous loop with no yield points), so this is client-side
 * staleness rejection, not worker-side abort.
 *
 * `RpcClient` itself stays fully generic and knows nothing about this
 * "latest wins" policy - it lives here, one layer up, specific to this one
 * use case.
 */
export class SketchSolveSession implements IDisposable {
    private readonly client: RpcClient;
    private latestRequestId: string | undefined;

    constructor(worker: WorkerLike) {
        this.client = new RpcClient(worker);
    }

    async solve(payload: SketchSolveWorkerPayload): Promise<SketchSolveWorkerResult | undefined> {
        const { id, result } = this.client.request<SketchSolveWorkerPayload, SketchSolveWorkerResult>(
            SOLVE_ACTION,
            payload,
        );
        this.latestRequestId = id;
        try {
            const settled = await result;
            return this.latestRequestId === id ? settled : undefined;
        } catch (error) {
            if (this.latestRequestId === id) throw error;
            return undefined;
        }
    }

    dispose(): void {
        this.client.dispose();
    }
}
