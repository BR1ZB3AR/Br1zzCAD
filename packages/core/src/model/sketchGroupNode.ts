// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Plane } from "../math";
import { serializable, serialize } from "../serialize";
import { GroupNode, type GroupNodeOptions } from "./groupNode";
import { NodeUtils } from "./node";
import type { SketchConstraint } from "./sketchConstraint";
import { SketchConstraintNode } from "./sketchConstraintNode";

export interface SketchGroupNodeOptions extends GroupNodeOptions {
    plane: Plane;
}

/**
 * A `GroupNode` created by `sketch.pickPlane` to collect one sketch's
 * geometry/dimensions. Remembers the working plane it was created on so
 * `sketch.edit` can restore it when re-entering the sketch later.
 */
@serializable()
export class SketchGroupNode extends GroupNode {
    @serialize()
    readonly plane: Plane;

    /** Geometric constraints (Coincident, Horizontal, ...) between this
     * sketch's own points - re-applied by `solveSketch` whenever the
     * sketch changes, not baked in once. Derived from this sketch's own
     * `SketchConstraintNode` children, not stored separately - each
     * constraint is a real tree node (visible in the Items tree, deletable
     * via the generic `modify.deleteNode` command with full undo/redo),
     * created via `constraintUtils.applyConstraint` rather than through
     * this class directly. */
    get constraints(): readonly SketchConstraint[] {
        return NodeUtils.findNodes(this, (n) => n instanceof SketchConstraintNode).map(
            (n) => (n as SketchConstraintNode).constraint,
        );
    }

    constructor(options: SketchGroupNodeOptions) {
        super(options);
        this.plane = options.plane;
    }
}
