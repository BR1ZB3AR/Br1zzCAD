// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type Residual, type SolveStatus, solve, type Unknowns } from "../sketchSolver";
import { NodeUtils } from "./node";
import type { SketchConstraint, UnknownIndex } from "./sketchConstraint";
import type { SketchGroupNode } from "./sketchGroupNode";
import { type ISketchPointOwner, isSketchPointOwner, type SketchPointHandle } from "./sketchPointOwner";

export type SketchSolveStatus = SolveStatus | "missingPoint";

export interface SketchSolveOutcome {
    status: SketchSolveStatus;
    finalResidualNorm: number;
}

function handleKey(handle: SketchPointHandle): string {
    return `${handle.nodeId}:${handle.role}`;
}

/**
 * Re-solves every constraint on a sketch and, on success, writes the
 * resulting positions back into the owning nodes via their own
 * `ISketchPointOwner.setSketchPoint` - which is all that's needed to
 * trigger mesh regeneration and undo recording (see `ShapeNode`'s
 * `setPropertyEmitShapeChanged`/`HistoryObservable.setProperty`), no
 * separate render or history plumbing required here. Leaves the sketch
 * untouched on failure, so a bad edit never corrupts existing geometry.
 */
export function solveSketch(sketch: SketchGroupNode): SketchSolveOutcome {
    const constraints: readonly SketchConstraint[] = sketch.constraints;
    if (constraints.length === 0) {
        return { status: "converged", finalResidualNorm: 0 };
    }

    const owners = new Map<string, ISketchPointOwner>();
    for (const node of NodeUtils.findNodes(sketch, isSketchPointOwner)) {
        owners.set((node as unknown as { id: string }).id, node as unknown as ISketchPointOwner);
    }

    const uniqueHandles = new Map<string, SketchPointHandle>();
    for (const constraint of constraints) {
        for (const handle of constraint.handles()) {
            uniqueHandles.set(handleKey(handle), handle);
        }
    }
    const handleList = Array.from(uniqueHandles.values());

    const offsetByKey = new Map<string, number>();
    const initial: Unknowns = new Float64Array(handleList.length * 2);
    for (let i = 0; i < handleList.length; i++) {
        const handle = handleList[i];
        const owner = owners.get(handle.nodeId);
        const point = owner?.getSketchPoint(handle.role);
        if (!owner || !point) {
            return { status: "missingPoint", finalResidualNorm: Number.NaN };
        }

        const { u, v } = sketch.plane.toUV(point);
        initial[i * 2] = u;
        initial[i * 2 + 1] = v;
        offsetByKey.set(handleKey(handle), i * 2);
    }

    const index: UnknownIndex = (handle) => offsetByKey.get(handleKey(handle))!;
    const residuals: Residual[] = constraints.flatMap((constraint) => constraint.residuals(index));

    const result = solve(initial, residuals);
    if (result.status === "converged") {
        for (let i = 0; i < handleList.length; i++) {
            const handle = handleList[i];
            const owner = owners.get(handle.nodeId)!;
            const point = sketch.plane.fromUV(result.unknowns[i * 2], result.unknowns[i * 2 + 1]);
            owner.setSketchPoint(handle.role, point);
        }
    }

    return { status: result.status, finalResidualNorm: result.finalResidualNorm };
}
