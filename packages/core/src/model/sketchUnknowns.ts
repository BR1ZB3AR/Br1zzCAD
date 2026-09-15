// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Unknowns } from "../sketchSolver";
import { NodeUtils } from "./node";
import type { SketchGroupNode } from "./sketchGroupNode";
import { type ISketchPointOwner, isSketchPointOwner, type SketchPointHandle } from "./sketchPointOwner";

export function handleKey(handle: SketchPointHandle): string {
    return `${handle.nodeId}:${handle.role}`;
}

export interface BuiltSketchUnknowns {
    status: "ok" | "missingPoint" | "invalidGeometry";
    /** handleKey -> offset into `pointValues`. */
    offsets: Map<string, number>;
    /** Every referenced handle's current (u, v), kept in sync with
     * `initial` by `readers` whenever a residual is evaluated. */
    pointValues: Float64Array;
    /** The flat solver-unknown vector - each owner contributes either 2
     * raw (u, v) values per handle, or (if it implements the parameterized
     * quartet) its own parameter vector once, regardless of how many
     * handles reference it. */
    initial: number[];
    /** nodeId -> the indices into `initial` that owner claims - used by
     * `sketchDofAnalyzer.ts` to attribute null-space freedom back to a
     * specific entity. */
    ownerUnknownIndices: Map<string, number[]>;
    /** Syncs `pointValues` from the solver's current trial `Unknowns` -
     * call before reading `pointValues`. */
    readers: ((values: Unknowns) => void)[];
    /** Writes a solved `Unknowns` vector back into each owner's real
     * properties - only meaningful once a solve has actually converged. */
    writers: ((values: Unknowns) => void)[];
    /** Per (parameterized) owner: is this solution geometrically valid
     * (e.g. a rectangle's width/height didn't collapse to zero)? */
    validators: ((values: Unknowns) => boolean)[];
    /** True if any owner took the parameterized-quartet branch (today:
     * `RectNode`) - that owner kind's point derivation needs live
     * document-model access mid-iteration (see `readers` above), which
     * cannot cross a Web Worker's `postMessage` boundary. Callers that
     * offload solving to a worker (`packages/worker`) use this to reject
     * up front rather than silently produce wrong geometry. */
    hasParameterizedOwner: boolean;
}

function emptyResult(status: "missingPoint" | "invalidGeometry"): BuiltSketchUnknowns {
    return {
        status,
        offsets: new Map(),
        pointValues: new Float64Array(0),
        initial: [],
        ownerUnknownIndices: new Map(),
        readers: [],
        writers: [],
        validators: [],
        hasParameterizedOwner: false,
    };
}

/**
 * Builds the solver's flat unknown vector (and the readers/writers/
 * validators that move values between it and each owner's real
 * properties) for exactly the given `handles` - shared by
 * `prepareSketchSolve` (which only includes constraint-referenced
 * handles, since there's nothing to solve for an untouched point) and
 * `analyzeSketchDOF` (which includes every owner's every point/parameter,
 * so a never-constrained point still reads as having freedom rather than
 * being silently excluded).
 *
 * A rectangle's 4 corners are really only 4 degrees of freedom (origin,
 * width, height), not 8 independent coordinates - an owner implementing
 * the parameterized quartet (`getSketchParameters`/
 * `getParameterizedSketchPoint`/`setSketchParameters`) gets solved through
 * its own parameters instead, exactly once regardless of how many of its
 * point roles are in `handles`.
 */
export function buildSketchUnknowns(
    sketch: SketchGroupNode,
    handles: readonly SketchPointHandle[],
    fixedNodeIds: ReadonlySet<string>,
): BuiltSketchUnknowns {
    const owners = new Map<string, ISketchPointOwner>();
    for (const node of NodeUtils.findNodes(sketch, isSketchPointOwner)) {
        if (isSketchPointOwner(node)) owners.set(node.id, node);
    }

    const offsets = new Map(handles.map((h, i) => [handleKey(h), i * 2]));
    const pointValues = new Float64Array(handles.length * 2);
    const initial: number[] = [];
    const ownerUnknownIndices = new Map<string, number[]>();
    const readers: ((values: Unknowns) => void)[] = [];
    const writers: ((values: Unknowns) => void)[] = [];
    const validators: ((values: Unknowns) => boolean)[] = [];
    let hasParameterizedOwner = false;

    const claim = (id: string, ...indices: number[]) => {
        const existing = ownerUnknownIndices.get(id);
        if (existing) existing.push(...indices);
        else ownerUnknownIndices.set(id, indices);
    };

    for (const [id, owner] of owners) {
        const owned = handles.filter((h) => h.nodeId === id);
        if (owned.length === 0) continue;
        for (const h of owned) {
            const point = owner.getSketchPoint(h.role);
            if (!point) return emptyResult("missingPoint");
            const { u, v } = sketch.plane.toUV(point);
            const offset = offsets.get(handleKey(h))!;
            pointValues[offset] = u;
            pointValues[offset + 1] = v;
        }
        if (fixedNodeIds.has(id)) continue;

        if (owner.getSketchParameters && owner.getParameterizedSketchPoint && owner.setSketchParameters) {
            hasParameterizedOwner = true;
            const parameters = owner.getSketchParameters(sketch.plane);
            const offset = initial.length;
            initial.push(...parameters);
            for (let i = 0; i < parameters.length; i++) claim(id, offset + i);
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
                claim(id, offset, offset + 1);
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

    if (handles.some((h) => !owners.has(h.nodeId))) return emptyResult("missingPoint");
    if (!initial.every(Number.isFinite) || !Array.from(pointValues).every(Number.isFinite)) {
        return emptyResult("invalidGeometry");
    }

    return {
        status: "ok",
        offsets,
        pointValues,
        initial,
        ownerUnknownIndices,
        readers,
        writers,
        validators,
        hasParameterizedOwner,
    };
}
