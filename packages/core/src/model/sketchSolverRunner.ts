// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type Residual, type SolveStatus, solve, type Unknowns } from "../sketchSolver";
import { NodeUtils } from "./node";
import type { UnknownIndex } from "./sketchConstraint";
import type { SketchGroupNode } from "./sketchGroupNode";
import { type ISketchPointOwner, isSketchPointOwner, type SketchPointHandle } from "./sketchPointOwner";

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

function handleKey(handle: SketchPointHandle): string {
    return `${handle.nodeId}:${handle.role}`;
}

/** Compute a solution without changing nodes or history. Edited nodes can
 * be held fixed so a parameter edit drives the rest of the sketch. */
export function prepareSketchSolve(
    sketch: SketchGroupNode,
    fixedNodeIds: ReadonlySet<string> = new Set(),
): PreparedSketchSolve {
    const constraints = sketch.constraints;
    if (constraints.length === 0) return { status: "converged", finalResidualNorm: 0 };

    const owners = new Map<string, ISketchPointOwner>();
    for (const node of NodeUtils.findNodes(sketch, isSketchPointOwner)) {
        if (isSketchPointOwner(node)) owners.set(node.id, node);
    }
    const handles = Array.from(
        new Map(constraints.flatMap((c) => c.handles().map((h) => [handleKey(h), h] as const))).values(),
    );
    const offsets = new Map(handles.map((h, i) => [handleKey(h), i * 2]));
    const pointValues = new Float64Array(handles.length * 2);
    const initial: number[] = [];
    const readers: ((values: Unknowns) => void)[] = [];
    const writers: ((values: Unknowns) => void)[] = [];
    const validators: ((values: Unknowns) => boolean)[] = [];

    for (const [id, owner] of owners) {
        const owned = handles.filter((h) => h.nodeId === id);
        if (owned.length === 0) continue;
        for (const h of owned) {
            const point = owner.getSketchPoint(h.role);
            if (!point) return { status: "missingPoint", finalResidualNorm: Number.NaN };
            const { u, v } = sketch.plane.toUV(point);
            const offset = offsets.get(handleKey(h))!;
            pointValues[offset] = u;
            pointValues[offset + 1] = v;
        }
        if (fixedNodeIds.has(id)) continue;

        if (owner.getSketchParameters && owner.getParameterizedSketchPoint && owner.setSketchParameters) {
            const parameters = owner.getSketchParameters(sketch.plane);
            const offset = initial.length;
            initial.push(...parameters);
            const valuesForOwner = (values: Unknowns) =>
                Array.from(values.slice(offset, offset + parameters.length));
            readers.push((values) => {
                const params = valuesForOwner(values);
                for (const h of owned) {
                    const point = owner.getParameterizedSketchPoint!(h.role, params, sketch.plane)!;
                    const uv = sketch.plane.toUV(point);
                    const pointOffset = offsets.get(handleKey(h))!;
                    pointValues[pointOffset] = uv.u;
                    pointValues[pointOffset + 1] = uv.v;
                }
            });
            validators.push((values) => owner.isValidSketchParameters?.(valuesForOwner(values)) ?? true);
            writers.push((values) => owner.setSketchParameters!(valuesForOwner(values), sketch.plane));
        } else {
            for (const h of owned) {
                const pointOffset = offsets.get(handleKey(h))!;
                const offset = initial.length;
                initial.push(pointValues[pointOffset], pointValues[pointOffset + 1]);
                readers.push((values) => {
                    pointValues[pointOffset] = values[offset];
                    pointValues[pointOffset + 1] = values[offset + 1];
                });
                writers.push((values) => {
                    const point = sketch.plane.fromUV(values[offset], values[offset + 1]);
                    if (owner.getSketchPoint(h.role)!.distanceTo(point) > 1e-9)
                        owner.setSketchPoint(h.role, point);
                });
            }
        }
    }

    if (handles.some((h) => !owners.has(h.nodeId))) {
        return { status: "missingPoint", finalResidualNorm: Number.NaN };
    }
    if (!initial.every(Number.isFinite) || !Array.from(pointValues).every(Number.isFinite)) {
        return { status: "invalidGeometry", finalResidualNorm: Number.NaN };
    }

    const index: UnknownIndex = (h) => offsets.get(handleKey(h))!;
    const equations = constraints.flatMap((c) => c.residuals(index));
    const residuals: Residual[] = equations.map((equation) => (values) => {
        for (const read of readers) read(values);
        return equation(pointValues);
    });
    const values = Float64Array.from(initial);
    const result = solve(values, residuals);
    // All-fixed sketches have no unknowns: explicitly check their equations.
    const norm = Math.hypot(...residuals.map((r) => r(result.unknowns)));
    if (!Number.isFinite(norm) || norm > 1e-7 || !validators.every((valid) => valid(result.unknowns))) {
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
                for (const write of writers) write(result.unknowns);
            }),
    };
}

/** Apply only validated solutions; failures leave geometry untouched. */
export function solveSketch(sketch: SketchGroupNode): SketchSolveOutcome {
    const result = prepareSketchSolve(sketch);
    result.apply?.();
    return { status: result.status, finalResidualNorm: result.finalResidualNorm };
}
