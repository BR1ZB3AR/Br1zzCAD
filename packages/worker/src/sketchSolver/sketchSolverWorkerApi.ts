// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    handleKey,
    type IDocument,
    type Serialized,
    Serializer,
    type SketchConstraint,
    type SketchPointHandle,
    type SolveOptions,
    type SolveResult,
    solve,
    type UnknownIndex,
    type Unknowns,
} from "@chili3d/core";

/**
 * Structured-clone-safe request for a worker-backed solve. Every constraint
 * has already been serialized (`Serializer.serializeObject`) on the main
 * thread; `offsets` gives each handle's slot in `initial` - the same
 * indexing `sketchSolverRunner.ts`'s `buildSketchUnknowns` already produces
 * for plain (non-parameterized) point owners.
 *
 * Deliberately does NOT support a sketch with any parameterized-quartet
 * owner referenced by a constraint (e.g. a rectangle,
 * `packages/app/src/bodys/rect.ts`) - that owner kind's point derivation
 * needs live document-model access mid-iteration (see
 * `buildSketchUnknowns`'s `readers`), which cannot cross a worker boundary
 * without a separate redesign. `hasParameterizedOwner` lets the caller flag
 * this up front so the worker rejects cleanly instead of silently solving
 * wrong geometry.
 */
export interface SketchSolveWorkerPayload {
    initial: Float64Array;
    constraints: Serialized[];
    offsets: Map<string, number>;
    hasParameterizedOwner: boolean;
    options?: SolveOptions;
}

export type SketchSolveWorkerResult =
    | ({ rejected?: false } & SolveResult)
    | { rejected: true; reason: string };

/** No `SketchConstraint` subclass has any `IDocument`-dependent behavior
 * (each one's constructor options are just `{id?}` plus its own plain
 * serialized fields) - this stub only exists to satisfy
 * `Serializer.deserializeObject`'s signature and is never actually read. */
const STUB_DOCUMENT = {} as IDocument;

/**
 * The actual worker-side solve logic - deliberately a plain, `self`-free
 * function (see `sketchSolver.worker.ts` for the ~10 lines of message
 * wiring around it) so it's directly unit-testable against a representative
 * payload with no worker/message-passing involved at all.
 */
export function solveSketchInWorker(payload: SketchSolveWorkerPayload): SketchSolveWorkerResult {
    if (payload.hasParameterizedOwner) {
        return {
            rejected: true,
            reason:
                "This sketch references a parameterized owner (e.g. a rectangle) - " +
                "worker-backed solving isn't supported for it yet. Use the existing " +
                "synchronous main-thread solveSketch/prepareSketchSolve instead.",
        };
    }

    const constraints = payload.constraints.map(
        (data) => Serializer.deserializeObject(STUB_DOCUMENT, data) as SketchConstraint,
    );
    const index: UnknownIndex = (handle: SketchPointHandle) => payload.offsets.get(handleKey(handle))!;
    const residuals = constraints.flatMap((c) => c.residuals(index));

    const result = solve(Float64Array.from(payload.initial) as Unknowns, residuals, payload.options);
    return { ...result, rejected: false };
}
