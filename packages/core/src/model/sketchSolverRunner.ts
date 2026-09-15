// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type Residual, type SolveStatus, solve } from "../sketchSolver";
import type { UnknownIndex } from "./sketchConstraint";
import type { SketchGroupNode } from "./sketchGroupNode";
import { buildSketchUnknowns, handleKey } from "./sketchUnknowns";

export type SketchSolveStatus = SolveStatus | "missingPoint" | "invalidGeometry";

export interface SketchSolveOutcome {
    status: SketchSolveStatus;
    finalResidualNorm: number;
}

export interface PreparedSketchSolve extends SketchSolveOutcome {
    apply?: () => void;
}

const solving = new WeakSet<SketchGroupNode>();

export function isSolvingSketch(sketch: SketchGroupNode): boolean {
    return solving.has(sketch);
}

export function withSketchSolveGuard<T>(sketch: SketchGroupNode, action: () => T): T {
    const alreadySolving = solving.has(sketch);
    solving.add(sketch);
    try {
        return action();
    } finally {
        if (!alreadySolving) solving.delete(sketch);
    }
}

/** Compute a solution without changing nodes or history. Edited nodes can
 * be held fixed so a parameter edit drives the rest of the sketch. */
export function prepareSketchSolve(
    sketch: SketchGroupNode,
    fixedNodeIds: ReadonlySet<string> = new Set(),
): PreparedSketchSolve {
    const constraints = sketch.constraints;
    if (constraints.length === 0) return { status: "converged", finalResidualNorm: 0 };

    const handles = Array.from(
        new Map(constraints.flatMap((c) => c.handles().map((h) => [handleKey(h), h] as const))).values(),
    );
    const built = buildSketchUnknowns(sketch, handles, fixedNodeIds);
    if (built.status !== "ok") {
        return { status: built.status, finalResidualNorm: Number.NaN };
    }

    const index: UnknownIndex = (h) => built.offsets.get(handleKey(h))!;
    const equations = constraints.flatMap((c) => c.residuals(index));
    const residuals: Residual[] = equations.map((equation) => (values) => {
        for (const read of built.readers) read(values);
        return equation(built.pointValues);
    });
    const values = Float64Array.from(built.initial);
    const result = solve(values, residuals);
    // All-fixed sketches have no unknowns: explicitly check their equations.
    const norm = Math.hypot(...residuals.map((r) => r(result.unknowns)));
    if (!Number.isFinite(norm) || norm > 1e-7 || !built.validators.every((valid) => valid(result.unknowns))) {
        return {
            status: result.status === "converged" ? "invalidGeometry" : result.status,
            finalResidualNorm: norm,
        };
    }
    return {
        status: "converged",
        finalResidualNorm: norm,
        apply: () =>
            withSketchSolveGuard(sketch, () => {
                for (const write of built.writers) write(result.unknowns);
            }),
    };
}

/** Apply only validated solutions; failures leave geometry untouched. */
export function solveSketch(sketch: SketchGroupNode): SketchSolveOutcome {
    const result = prepareSketchSolve(sketch);
    result.apply?.();
    return { status: result.status, finalResidualNorm: result.finalResidualNorm };
}
