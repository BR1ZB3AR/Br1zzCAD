// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Plane } from "../math";
import { serializable, serialize } from "../serialize";
import { GroupNode, type GroupNodeOptions } from "./groupNode";

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

    constructor(options: SketchGroupNodeOptions) {
        super(options);
        this.plane = options.plane;
    }
}
