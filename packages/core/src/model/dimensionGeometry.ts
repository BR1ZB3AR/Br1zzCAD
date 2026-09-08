// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "../math";
import type { DimensionType } from "./annotation";

export interface LinearDimensionGeometry {
    /** From the measured start point out to the dimension line. */
    extension1: [XYZ, XYZ];
    /** From the measured end point out to the dimension line. */
    extension2: [XYZ, XYZ];
    dimensionLine: [XYZ, XYZ];
    /** Unit vector along the dimension line, start->end - for drawing arrowheads. */
    direction: XYZ;
    /** In-plane unit vector perpendicular to `direction` - for drawing arrowheads. */
    perp: XYZ;
    labelPosition: XYZ;
    value: number;
}

/**
 * A linear dimension is always drawn ALIGNED (parallel to start->end) - that
 * covers horizontal/vertical too, since those are just the case where the
 * measured segment already runs along one axis. `placement` (where the user
 * clicked to position it) picks which side the extension lines offset to,
 * and by how far.
 */
export function computeLinearDimensionGeometry(
    start: XYZ,
    end: XYZ,
    placement: XYZ,
): LinearDimensionGeometry {
    const value = start.distanceTo(end);
    const direction = value > 1e-9 ? end.sub(start).normalize()! : XYZ.unitX;
    const toPlacement = placement.sub(start);

    // Normal of the plane containing the measured segment and the placement
    // point, then rotate back into that plane, perpendicular to `direction` -
    // self-contained (no external workplane needed), and degrades gracefully
    // (falls back to unitY) when placement sits on the start-end line itself.
    const rawNormal = direction.cross(toPlacement);
    let perp = rawNormal.length() > 1e-9 ? rawNormal.cross(direction).normalize()! : XYZ.unitY;
    const side = toPlacement.dot(perp);
    if (side < 0) perp = perp.reverse();
    const offset = Math.abs(side);

    const dimStart = start.add(perp.multiply(offset));
    const dimEnd = end.add(perp.multiply(offset));

    return {
        extension1: [start, dimStart],
        extension2: [end, dimEnd],
        dimensionLine: [dimStart, dimEnd],
        direction,
        perp,
        labelPosition: XYZ.center(dimStart, dimEnd),
        value,
    };
}

export interface RadialDimensionGeometry {
    /** From the circle's center out past its edge, toward wherever the
     * dimension was placed. */
    line: [XYZ, XYZ];
    /** Unit vector along `line`, center->outward - for drawing an arrowhead. */
    direction: XYZ;
    /** Some vector perpendicular to `direction` - for drawing an arrowhead. */
    perp: XYZ;
    labelPosition: XYZ;
    value: number;
}

/** Any unit vector perpendicular to `v` - exact orientation doesn't matter,
 * only used to spread a cosmetic arrowhead's two wings apart. */
function anyPerpendicular(v: XYZ): XYZ {
    const reference = Math.abs(v.z) < 0.9 ? XYZ.unitZ : XYZ.unitX;
    return v.cross(reference).normalize() ?? XYZ.unitX;
}

/**
 * `center`/`onCircle` fix the actual radius; `placement` only steers which
 * direction around the circle the dimension line points (and how far past
 * the edge it's drawn), matching how dragging a radius dimension around a
 * circle works in most CAD sketchers.
 */
export function computeRadialDimensionGeometry(
    center: XYZ,
    onCircle: XYZ,
    placement: XYZ,
    type: Extract<DimensionType, "radial" | "diameter">,
): RadialDimensionGeometry {
    const radius = center.distanceTo(onCircle);
    const toPlacement = placement.sub(center);
    const placementDistance = toPlacement.length();
    const direction =
        placementDistance > 1e-9 ? toPlacement.normalize()! : (onCircle.sub(center).normalize() ?? XYZ.unitX);

    const lineEnd = center.add(direction.multiply(Math.max(radius, placementDistance)));
    const value = type === "diameter" ? radius * 2 : radius;

    return {
        line: [center, lineEnd],
        direction,
        perp: anyPerpendicular(direction),
        labelPosition: XYZ.center(center, lineEnd),
        value,
    };
}

const ANGLE_ARC_SEGMENTS = 24;

export interface AngleDimensionGeometry {
    /** Points sampling the arc from the first edge's direction to the
     * second's, in order - render as a connected polyline. */
    arcPoints: XYZ[];
    /** Outward radial direction at the arc's first end - for its arrowhead. */
    startPerp: XYZ;
    /** Tangent-along-the-arc direction at the first end, pointing inward
     * (toward the second sample point) - the arrowhead's shaft direction. */
    startDirection: XYZ;
    /** Outward radial direction at the arc's second end - for its arrowhead. */
    endPerp: XYZ;
    /** Tangent-along-the-arc direction at the second end, pointing inward. */
    endDirection: XYZ;
    labelPosition: XYZ;
    /** The measured angle, in degrees. */
    value: number;
}

/**
 * `vertex` is the shared point the two edges are measured from; `point1`/
 * `point2` are any other point along each edge (only their direction from
 * `vertex` matters). `placement`'s distance from `vertex` sets the arc's
 * radius - same drag-to-reposition idea as the other dimension types, just
 * driving a radius instead of an offset.
 */
export function computeAngleDimensionGeometry(
    vertex: XYZ,
    point1: XYZ,
    point2: XYZ,
    placement: XYZ,
): AngleDimensionGeometry {
    const dir1 = point1.sub(vertex).normalize() ?? XYZ.unitX;
    const dir2raw = point2.sub(vertex).normalize() ?? XYZ.unitY;

    const rawNormal = dir1.cross(dir2raw);
    const normal = rawNormal.length() > 1e-9 ? rawNormal.normalize()! : anyPerpendicular(dir1);

    const cos = Math.max(-1, Math.min(1, dir1.dot(dir2raw)));
    const angle = Math.acos(cos);

    const placementDistance = vertex.distanceTo(placement);
    const radius = placementDistance > 1e-9 ? placementDistance : 10;

    const arcPoints: XYZ[] = [];
    for (let i = 0; i <= ANGLE_ARC_SEGMENTS; i++) {
        const t = (angle * i) / ANGLE_ARC_SEGMENTS;
        // `normal` is always a valid unit vector by construction above, so
        // rotating the (also unit-length) `dir1` around it never fails.
        arcPoints.push(vertex.add(dir1.rotate(normal, t)!.multiply(radius)));
    }

    const startPoint = arcPoints[0];
    const endPoint = arcPoints[arcPoints.length - 1];
    const startPerp = startPoint.sub(vertex).normalize() ?? dir1;
    const endPerp = endPoint.sub(vertex).normalize() ?? dir2raw;
    const startDirection = arcPoints[1].sub(startPoint).normalize() ?? dir1;
    const endDirection = arcPoints[arcPoints.length - 2].sub(endPoint).normalize() ?? dir2raw;

    const midT = angle / 2;
    const labelPosition = vertex.add(dir1.rotate(normal, midT)!.multiply(radius));

    return {
        arcPoints,
        startPerp,
        startDirection,
        endPerp,
        endDirection,
        labelPosition,
        value: (angle * 180) / Math.PI,
    };
}
