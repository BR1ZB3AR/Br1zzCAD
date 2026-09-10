// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Matrix4 } from "./math";
import { type INode, ShapeNode } from "./model";
import type { IShape } from "./shape";

export interface IShapeFilter {
    allow(shape: IShape, transform: Matrix4): boolean;
}

export interface INodeFilter {
    allow(node: INode): boolean;
}

export class ShapeNodeFilter implements INodeFilter {
    constructor(readonly shapeFilter?: IShapeFilter) {}

    allow(node: INode): boolean {
        if (node instanceof ShapeNode) {
            if (this.shapeFilter && node.shape.isOk) {
                return this.shapeFilter.allow(node.shape.value, node.transform);
            }
            return true;
        }

        return false;
    }
}

/**
 * Rejects a shape node marked construction (see `ShapeNode.isConstruction`).
 * Construction/guide geometry is meant to help draw real profiles, not
 * become 3D material itself - so Extrude/Revolve/Loft/Sweep's *profile* pick
 * uses this to exclude it, matching how FreeCAD and other CAD tools treat
 * construction geometry. It's still usable as a reference (e.g. a Revolve
 * axis or Sweep path), since those picks don't apply this filter.
 */
export const nonConstructionNodeFilter: INodeFilter = {
    allow: (node: INode) => !(node instanceof ShapeNode && node.isConstruction),
};
