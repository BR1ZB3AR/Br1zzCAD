// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { CurveUtils, type ICircle, type IEdge, type IShape, type IShapeFilter } from "@chili3d/core";

/** An edge's own `.curve` is always the ITrimmedCurve wrapper, never the
 * circle itself - the circle only shows up one level down, as `basisCurve`. */
export function circleFromEdge(edge: IEdge): ICircle | undefined {
    const basis = edge.curve.basisCurve;
    return CurveUtils.isCircle(basis) ? basis : undefined;
}

/** Restricts an edge-picking step to circular edges only, for the Radius/
 * Diameter dimension tools. */
export const circularEdgeFilter: IShapeFilter = {
    allow(shape: IShape) {
        return circleFromEdge(shape as IEdge) !== undefined;
    },
};
