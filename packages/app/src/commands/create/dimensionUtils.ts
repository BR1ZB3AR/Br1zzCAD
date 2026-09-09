// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CurveUtils,
    type DimensionAnnotation,
    type DimensionEditHandler,
    type DimensionType,
    type ICircle,
    type IEdge,
    type IShape,
    type IShapeFilter,
    Precision,
    type VisualNode,
    type XYZ,
} from "@chili3d/core";
import { CircleNode, LineNode, RectNode } from "../../bodys";

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

/** Restricts an edge-picking step to straight edges only, for the Linear
 * dimension tool - picking the edge itself (rather than two separate
 * point-clicks) sidesteps vertex-snap precision issues entirely, since the
 * edge's own curve gives its endpoints exactly. */
export const straightEdgeFilter: IShapeFilter = {
    allow(shape: IShape) {
        const edge = shape as IEdge;
        return CurveUtils.isLine(edge.curve.basisCurve);
    },
};

/** A linear dimension is editable when both picked points are the two
 * endpoints of a single LineNode - editing moves whichever endpoint isn't
 * the one the user effectively "anchored" first. */
export function lineNodeEditHandler(
    annotation: DimensionAnnotation,
    line: LineNode,
    start: XYZ,
    end: XYZ,
): DimensionEditHandler | undefined {
    const startIsLineStart = start.distanceTo(line.start) < Precision.Distance;
    const startIsLineEnd = start.distanceTo(line.end) < Precision.Distance;
    const endIsLineStart = end.distanceTo(line.start) < Precision.Distance;
    const endIsLineEnd = end.distanceTo(line.end) < Precision.Distance;
    if (!((startIsLineStart && endIsLineEnd) || (startIsLineEnd && endIsLineStart))) return undefined;

    const movingIsEnd = startIsLineStart;
    return (newLength: number) => {
        if (newLength <= Precision.Distance) return false;
        const pinned = movingIsEnd ? line.start : line.end;
        const moving = movingIsEnd ? line.end : line.start;
        const direction = moving.sub(pinned).normalize();
        if (!direction) return false;
        const newPoint = pinned.add(direction.multiply(newLength));
        if (movingIsEnd) line.end = newPoint;
        else line.start = newPoint;

        // Keep the annotation's own points in sync so the rendered
        // extension/dimension lines track the line they measure.
        if (movingIsEnd) annotation.endPoint = newPoint;
        else annotation.startPoint = newPoint;
        return true;
    };
}

/** A RectNode's 4 corners, in winding order [p0, p1, p2, p3] - p0 is the
 * plane-anchored corner (`RectNode.points` always keeps it fixed), p1 is
 * offset from it by `dx`, p2 by both `dx` and `dy`, p3 by `dy` alone. */
function rectCorners(rect: RectNode): XYZ[] {
    return RectNode.points(rect.plane, rect.dx, rect.dy).slice(0, 4);
}

/** Which corner of a rect edge doesn't move when the given side is edited
 * (`anchor`), which one does (`moving`). Every edge measures either `dx` or
 * `dy`; the anchor is always the corner on that edge that doesn't itself
 * depend on that parameter - the new position of `moving` is then just
 * re-read off the rect after the edit, not computed by hand. */
const RECT_EDGES: ReadonlyArray<{
    anchor: number;
    moving: number;
    param: "dx" | "dy";
}> = [
    { anchor: 0, moving: 1, param: "dx" },
    { anchor: 1, moving: 2, param: "dy" },
    { anchor: 3, moving: 2, param: "dx" },
    { anchor: 0, moving: 3, param: "dy" },
];

/** A linear dimension is editable when both picked points are adjacent
 * corners of a single RectNode - editing writes the new length back to
 * whichever of `dx`/`dy` that edge measures, without disturbing the
 * rectangle's other side. */
export function rectNodeEditHandler(
    annotation: DimensionAnnotation,
    rect: RectNode,
    start: XYZ,
    end: XYZ,
): DimensionEditHandler | undefined {
    const corners = rectCorners(rect);

    for (const edge of RECT_EDGES) {
        const anchorPt = corners[edge.anchor];
        const movingPt = corners[edge.moving];
        const startIsAnchor = start.distanceTo(anchorPt) < Precision.Distance;
        const startIsMoving = start.distanceTo(movingPt) < Precision.Distance;
        const endIsAnchor = end.distanceTo(anchorPt) < Precision.Distance;
        const endIsMoving = end.distanceTo(movingPt) < Precision.Distance;
        if (!((startIsAnchor && endIsMoving) || (startIsMoving && endIsAnchor))) continue;

        const movingIsEnd = startIsAnchor;
        return (newValue: number) => {
            if (newValue <= Precision.Distance) return false;
            if (edge.param === "dx") rect.dx = newValue;
            else rect.dy = newValue;

            const newMoving = rectCorners(rect)[edge.moving];
            if (movingIsEnd) annotation.endPoint = newMoving;
            else annotation.startPoint = newMoving;
            return true;
        };
    }
    return undefined;
}

/** Dispatches to whichever edit handler applies to a straight edge's owner
 * (LineNode or RectNode) - shared by the Linear and Auto dimension tools so
 * both drive the exact same write-back logic for the exact same shape
 * types. */
export function linearEdgeEditHandler(
    annotation: DimensionAnnotation,
    owner: VisualNode,
    start: XYZ,
    end: XYZ,
): DimensionEditHandler | undefined {
    if (owner instanceof LineNode) return lineNodeEditHandler(annotation, owner, start, end);
    if (owner instanceof RectNode) return rectNodeEditHandler(annotation, owner, start, end);
    return undefined;
}

/** A radial/diameter dimension is editable when the picked circular edge
 * belongs to a CircleNode - its `radius` is a plain settable property.
 * Shared by the Radius/Diameter and Auto dimension tools. */
export function circleNodeEditHandler(
    annotation: DimensionAnnotation,
    owner: VisualNode,
    center: XYZ,
    onCircle: XYZ,
    dimensionType: Extract<DimensionType, "radial" | "diameter">,
): DimensionEditHandler | undefined {
    if (!(owner instanceof CircleNode)) return undefined;
    const direction = onCircle.sub(center).normalize();
    if (!direction) return undefined;

    return (newValue: number) => {
        const radius = dimensionType === "diameter" ? newValue / 2 : newValue;
        if (radius <= Precision.Distance) return false;
        owner.radius = radius;

        // Keep the annotation's own endPoint in sync so the rendered
        // radial line tracks the circle it measures.
        annotation.endPoint = center.add(direction.multiply(radius));
        return true;
    };
}
