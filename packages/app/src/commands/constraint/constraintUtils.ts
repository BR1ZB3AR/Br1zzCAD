// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type IDocument,
    type INode,
    isSketchPointOwner,
    PubSub,
    type SketchConstraint,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
    type SnapResult,
    solveSketch,
    Transaction,
    type VisualShapeData,
} from "@chili3d/core";

/**
 * A picked vertex's `IShape` has no idea which of its owning node's roles
 * it is (start vs end, which corner, ...) - only the owning node's own
 * `ISketchPointOwner.sketchPointRoles()` does. So this resolves a pick by
 * finding whichever of the owner's declared points is (numerically)
 * closest to the picked vertex's actual position, rather than relying on
 * shape sub-indexing, which isn't guaranteed to line up with role order.
 *
 * Reads the world-space position the detection layer already computed
 * (`VisualShapeData.point`, populated by `ThreeView`'s raycast hit-testing
 * for every sub-shape pick, vertex included - see `detectSubShapes` in
 * `threeView.ts`) rather than casting `.shape` to `IVertex` and calling
 * `.point()` itself, which threw in practice (a picked vertex's `.shape`
 * isn't guaranteed to be a plain object exposing that method). `.point` is
 * already the exact value that method would have returned, so this is
 * strictly more robust, not just a workaround.
 */
export function resolveSketchPointHandle(shapeData: VisualShapeData): SketchPointHandle | undefined {
    const node = shapeData.owner.node;
    if (!isSketchPointOwner(node)) return undefined;

    const picked = shapeData.point;
    if (!picked) return undefined;

    let bestRole: string | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const role of node.sketchPointRoles()) {
        const point = node.getSketchPoint(role);
        if (!point) continue;
        const distance = point.distanceTo(picked);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestRole = role;
        }
    }
    if (bestRole === undefined) return undefined;

    return new SketchPointHandle({ nodeId: (node as unknown as { id: string }).id, role: bestRole });
}

/** Resolves every picked shape in a selection step's result to a point
 * handle, silently dropping any pick that doesn't resolve (e.g. a vertex
 * belonging to a node type Phase 1 doesn't support yet). */
export function resolveSketchPointHandles(step: SnapResult): SketchPointHandle[] {
    return step.shapes
        .map(resolveSketchPointHandle)
        .filter((handle): handle is SketchPointHandle => handle !== undefined);
}

/** Walks up from a picked node to the `SketchGroupNode` it's drawn inside -
 * constraints are stored per-sketch (`SketchGroupNode.constraints`), so a
 * constraint command needs this to know which sketch to attach to. */
export function findOwningSketch(node: INode): SketchGroupNode | undefined {
    let current: INode | undefined = node;
    while (current) {
        if (current instanceof SketchGroupNode) return current;
        current = current.parent;
    }
    return undefined;
}

/** Adds a constraint (as a real `SketchConstraintNode` child of the sketch -
 * visible in the Items tree, deletable via the generic delete command) and
 * immediately re-solves the sketch, inside one transaction. If the solve
 * doesn't converge, the node is rolled back (never left attached in a
 * permanently-unsatisfiable state) and the user is told why - the sketch's
 * existing geometry is never touched by a failed attempt, only ever by a
 * successful one. Returns whether it stuck. */
export function applyConstraint(
    document: IDocument,
    sketch: SketchGroupNode,
    constraint: SketchConstraint,
): boolean {
    let succeeded = false;
    const node = new SketchConstraintNode({ document, constraint });
    Transaction.execute(document, `add ${constraint.kind} constraint`, () => {
        sketch.add(node);
        const outcome = solveSketch(sketch);
        if (outcome.status === "converged") {
            succeeded = true;
        } else {
            sketch.remove(node);
            PubSub.default.pub("showToast", "toast.constraint.unsolvable");
        }
    });
    return succeeded;
}
