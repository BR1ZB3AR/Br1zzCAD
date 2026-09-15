// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    buildSketchUnknowns,
    handleKey,
    type IDisposable,
    Serializer,
    type SketchGroupNode,
    type SketchSolveOutcome,
    Transaction,
    withSketchSolveGuard,
} from "@chili3d/core";
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

/**
 * The document-aware half of worker-backed solving: reads a sketch's
 * current geometry/constraints (via the same `buildSketchUnknowns` the
 * synchronous `prepareSketchSolve` already uses, unchanged), dispatches the
 * numeric solve to `session`, and - only on a genuine, non-stale,
 * converged result - writes it back into the live document nodes inside a
 * real `Transaction`. This lives in `packages/worker`, not `packages/core`,
 * because it needs `SketchSolveSession`; `core` stays worker-agnostic (the
 * existing one-way dependency direction - `three`/`worker`/`wasm` depend on
 * `core`, never the reverse).
 *
 * Only ever applies the constraint VALUE edit's own undo step (already
 * recorded separately, see `SketchConstraintNode.distance`'s setter) plus
 * this geometry write-back as a second, later transaction - not one atomic
 * step, since holding a transaction open across this unbounded async gap
 * would risk colliding with any other edit the user makes in the meantime
 * (`Transaction.start()` throws if one is already active on the document).
 */
export async function resolveSketchViaWorker(
    sketch: SketchGroupNode,
    session: SketchSolveSession,
): Promise<SketchSolveOutcome> {
    const constraints = sketch.constraints;
    if (constraints.length === 0) return { status: "converged", finalResidualNorm: 0 };

    const handles = Array.from(
        new Map(constraints.flatMap((c) => c.handles().map((h) => [handleKey(h), h] as const))).values(),
    );
    const built = buildSketchUnknowns(sketch, handles, new Set());
    if (built.status !== "ok") return { status: built.status, finalResidualNorm: Number.NaN };

    const result = await session.solve({
        initial: Float64Array.from(built.initial),
        constraints: constraints.map((c) => Serializer.serializeObject(c)),
        offsets: built.offsets,
        hasParameterizedOwner: built.hasParameterizedOwner,
    });

    if (!result) {
        // Superseded by a newer request before this one's response arrived
        // - nothing to apply, and nothing went wrong either.
        return { status: "singular", finalResidualNorm: Number.NaN };
    }
    if (result.rejected) {
        return { status: "invalidGeometry", finalResidualNorm: Number.NaN };
    }
    if (result.status !== "converged") {
        return { status: result.status, finalResidualNorm: result.finalResidualNorm };
    }

    Transaction.execute(sketch.document, "resolve sketch (worker)", () =>
        withSketchSolveGuard(sketch, () => {
            for (const write of built.writers) write(result.unknowns);
        }),
    );
    return { status: "converged", finalResidualNorm: result.finalResidualNorm };
}
