// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Plane } from "../math";
import { serializable, serialize } from "../serialize";
import { GroupNode, type GroupNodeOptions } from "./groupNode";
import type { SketchConstraint } from "./sketchConstraint";

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
     * sketch changes, not baked in once. */
    @serialize()
    get constraints(): readonly SketchConstraint[] {
        return this.getPrivateValue("constraints", []);
    }
    set constraints(value: readonly SketchConstraint[]) {
        this.setProperty("constraints", value);
    }

    constructor(options: SketchGroupNodeOptions) {
        super(options);
        this.plane = options.plane;
    }

    addConstraint(constraint: SketchConstraint) {
        this.constraints = [...this.constraints, constraint];
    }

    removeConstraint(id: string) {
        this.constraints = this.constraints.filter((c) => c.id !== id);
    }
}
