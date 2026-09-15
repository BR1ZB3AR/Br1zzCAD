// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { multiplyJtJ, nullSpaceOfSymmetric, numericJacobian, type Residual } from "../sketchSolver";
import { NodeUtils } from "./node";
import type { UnknownIndex } from "./sketchConstraint";
import type { SketchGroupNode } from "./sketchGroupNode";
import { isSketchPointOwner, SketchPointHandle } from "./sketchPointOwner";
import { buildSketchUnknowns, handleKey } from "./sketchUnknowns";

export type SketchDofStatus = "underConstrained" | "fullyConstrained" | "conflicting";

const FREEDOM_TOLERANCE = 1e-6;
const CONFLICT_TOLERANCE = 1e-6;
const JACOBIAN_EPSILON = 1e-7;

/**
 * Classifies every point-owning entity in `sketch` by how much freedom it
 * has left under the sketch's current constraints, evaluated at the
 * sketch's CURRENT geometry (never re-solved) - a live status readout, not
 * a solve.
 *
 * Unlike `prepareSketchSolve` (which only turns a point into a solver
 * unknown if some constraint actually references it, since there's
 * nothing to solve for otherwise), this includes every owner's every
 * declared point/parameter, so a point no constraint has ever touched
 * still correctly reads as under-constrained rather than being silently
 * excluded.
 *
 * "Conflicting" is only reachable if a sketch is ever left in a state
 * where some constraint's own residual doesn't evaluate to ~zero - today
 * both `applyConstraint` and `ParameterShapeNode.setPropertyEmitShapeChanged`
 * always roll back a solve that doesn't converge, so committed geometry
 * never actually reaches that state through the shipped UI. This is
 * intentionally still checked for, as a defensive readout for whatever
 * commits geometry next (a future drag gizmo, say) rather than assuming
 * the invariant holds forever.
 */
export function analyzeSketchDOF(sketch: SketchGroupNode): Map<string, SketchDofStatus> {
    const result = new Map<string, SketchDofStatus>();

    const owners = NodeUtils.findNodes(sketch, isSketchPointOwner);
    if (owners.length === 0) return result;

    const handles: SketchPointHandle[] = [];
    for (const owner of owners) {
        if (!isSketchPointOwner(owner)) continue;
        for (const role of owner.sketchPointRoles()) {
            handles.push(new SketchPointHandle({ nodeId: owner.id, role }));
        }
    }

    const built = buildSketchUnknowns(sketch, handles, new Set());
    if (built.status !== "ok") return result; // degenerate current geometry: leave callers' last-known colors alone

    const x0 = Float64Array.from(built.initial);
    const index: UnknownIndex = (h) => built.offsets.get(handleKey(h))!;
    const perConstraint = sketch.constraints.map((constraint) => ({
        constraint,
        equations: constraint.residuals(index),
    }));

    // `equation`s are indexed handle-space (via `index`/`built.offsets`),
    // matching `built.pointValues` - but the Jacobian needs to be taken
    // with respect to the actual solver unknowns (`x0`/`built.initial`),
    // a different space for any parameterized owner (e.g. a rect's 4
    // unknowns are [originU, originV, dx, dy], not per-corner (u, v)
    // pairs). Route through `built.readers` first, exactly like
    // `prepareSketchSolve` already does for the residuals it hands to
    // `solve()`, so a trial perturbation of a solver unknown correctly
    // propagates into the handle-space values each equation reads.
    const solverSpaceResiduals: Residual[] = perConstraint
        .flatMap((pc) => pc.equations)
        .map((equation) => (values) => {
            for (const read of built.readers) read(values);
            return equation(built.pointValues);
        });

    let nullBasis: Float64Array[] = [];
    if (x0.length > 0) {
        const jacobian = numericJacobian(solverSpaceResiduals, x0, JACOBIAN_EPSILON);
        const jtj = multiplyJtJ(jacobian, solverSpaceResiduals.length, x0.length);
        nullBasis = nullSpaceOfSymmetric(jtj, x0.length);
    }

    for (const owner of owners) {
        if (!isSketchPointOwner(owner)) continue;
        const range = built.ownerUnknownIndices.get(owner.id);
        if (!range || range.length === 0) continue;
        const free = nullBasis.some((v) => range.some((i) => Math.abs(v[i]) > FREEDOM_TOLERANCE));
        result.set(owner.id, free ? "underConstrained" : "fullyConstrained");
    }

    // Overlay conflicts: evaluate each constraint's own equations directly
    // against the sketch's actual current point values (already fresh -
    // `buildSketchUnknowns` populates `pointValues` from real geometry up
    // front, no re-read needed).
    for (const { constraint, equations } of perConstraint) {
        const violated = equations.some((eq) => Math.abs(eq(built.pointValues)) > CONFLICT_TOLERANCE);
        if (!violated) continue;
        for (const handle of constraint.handles()) {
            if (result.has(handle.nodeId)) result.set(handle.nodeId, "conflicting");
        }
    }

    return result;
}
