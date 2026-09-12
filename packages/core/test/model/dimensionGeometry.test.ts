// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "../../src/math";
import {
    computeAngleDimensionGeometry,
    computeLinearDimensionGeometry,
    computeRadialDimensionGeometry,
} from "../../src/model/dimensionGeometry";

describe("computeLinearDimensionGeometry", () => {
    test("should compute the distance as value", () => {
        const start = new XYZ({ x: 0, y: 0, z: 0 });
        const end = new XYZ({ x: 10, y: 0, z: 0 });
        const placement = new XYZ({ x: 5, y: 5, z: 0 });

        const geometry = computeLinearDimensionGeometry(start, end, placement);

        expect(geometry.value).toBeCloseTo(10, 6);
    });

    test("should offset the dimension line toward the placement point", () => {
        const start = new XYZ({ x: 0, y: 0, z: 0 });
        const end = new XYZ({ x: 10, y: 0, z: 0 });
        const placement = new XYZ({ x: 5, y: 5, z: 0 });

        const geometry = computeLinearDimensionGeometry(start, end, placement);

        expect(geometry.dimensionLine[0].y).toBeCloseTo(5, 6);
        expect(geometry.dimensionLine[1].y).toBeCloseTo(5, 6);
        expect(geometry.extension1).toEqual([start, geometry.dimensionLine[0]]);
        expect(geometry.extension2).toEqual([end, geometry.dimensionLine[1]]);
    });

    test("should offset to the opposite side when placement is on the other side", () => {
        const start = new XYZ({ x: 0, y: 0, z: 0 });
        const end = new XYZ({ x: 10, y: 0, z: 0 });
        const placement = new XYZ({ x: 5, y: -5, z: 0 });

        const geometry = computeLinearDimensionGeometry(start, end, placement);

        expect(geometry.dimensionLine[0].y).toBeCloseTo(-5, 6);
    });

    test("direction should be the unit vector from start to end", () => {
        const start = new XYZ({ x: 0, y: 0, z: 0 });
        const end = new XYZ({ x: 0, y: 20, z: 0 });
        const placement = new XYZ({ x: 5, y: 10, z: 0 });

        const geometry = computeLinearDimensionGeometry(start, end, placement);

        expect(geometry.direction.isEqualTo(XYZ.unitY, 1e-6)).toBe(true);
    });

    test("labelPosition should be the midpoint of the dimension line", () => {
        const start = new XYZ({ x: 0, y: 0, z: 0 });
        const end = new XYZ({ x: 10, y: 0, z: 0 });
        const placement = new XYZ({ x: 5, y: 5, z: 0 });

        const geometry = computeLinearDimensionGeometry(start, end, placement);

        expect(geometry.labelPosition.x).toBeCloseTo(5, 6);
        expect(geometry.labelPosition.y).toBeCloseTo(5, 6);
    });

    test("should fall back to a stable perpendicular when placement is collinear with start/end", () => {
        const start = new XYZ({ x: 0, y: 0, z: 0 });
        const end = new XYZ({ x: 10, y: 0, z: 0 });
        const placement = new XYZ({ x: 5, y: 0, z: 0 });

        const geometry = computeLinearDimensionGeometry(start, end, placement);

        expect(Number.isFinite(geometry.perp.x)).toBe(true);
        expect(Number.isFinite(geometry.perp.y)).toBe(true);
        expect(Number.isFinite(geometry.perp.z)).toBe(true);
    });

    test("should report zero-length value for coincident points", () => {
        const start = new XYZ({ x: 3, y: 3, z: 3 });
        const placement = new XYZ({ x: 5, y: 5, z: 5 });

        const geometry = computeLinearDimensionGeometry(start, start, placement);

        expect(geometry.value).toBe(0);
    });
});

describe("computeRadialDimensionGeometry", () => {
    test("radial value should equal the radius", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 5, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "radial");

        expect(geometry.value).toBeCloseTo(5, 6);
    });

    test("diameter value should be twice the radius", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 5, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "diameter");

        expect(geometry.value).toBeCloseTo(10, 6);
    });

    test("line should point from center toward the placement direction", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 3, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "radial");

        expect(geometry.line[0]).toEqual(center);
        expect(geometry.direction.isEqualTo(XYZ.unitY, 1e-6)).toBe(true);
        expect(geometry.line[1].y).toBeCloseTo(5, 6);
    });

    test("line should extend to the placement distance when it is farther than the radius", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 15, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "radial");

        expect(geometry.line[1].y).toBeCloseTo(15, 6);
    });

    test("should fall back to the onCircle direction when placement coincides with center", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, center, "radial");

        expect(geometry.direction.isEqualTo(XYZ.unitX, 1e-6)).toBe(true);
    });

    test("labelPosition should be the midpoint of the line", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 8, y: 0, z: 0 });
        const placement = new XYZ({ x: 8, y: 0, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "radial");

        expect(geometry.labelPosition.x).toBeCloseTo(4, 6);
    });

    test("isDiameter should be false for a radial dimension", () => {
        const center = XYZ.zero;
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, onCircle, "radial");

        expect(geometry.isDiameter).toBe(false);
    });

    test("isDiameter should be true for a diameter dimension", () => {
        const center = XYZ.zero;
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, onCircle, "diameter");

        expect(geometry.isDiameter).toBe(true);
    });

    test("diameter line should span both edges through the center, not just center-to-edge", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 8, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "diameter");

        // direction follows placement (unitY here), radius is 5 either way.
        expect(geometry.line[0].y).toBeCloseTo(-5, 6);
        expect(geometry.line[1].y).toBeCloseTo(5, 6);
        expect(geometry.line[0].x).toBeCloseTo(0, 6);
        expect(geometry.line[1].x).toBeCloseTo(0, 6);
    });

    test("diameter line should stay exactly at the radius even when placement is farther away", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 20, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "diameter");

        expect(geometry.line[1].y).toBeCloseTo(5, 6);
        expect(geometry.line[0].y).toBeCloseTo(-5, 6);
    });

    test("diameter labelPosition sits at the edge when placement is at (or inside) the radius", () => {
        const center = new XYZ({ x: 3, y: 4, z: 0 });
        const onCircle = new XYZ({ x: 8, y: 4, z: 0 });
        const placement = new XYZ({ x: 8, y: 4, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "diameter");

        // Clamped to the edge (distance = radius), not the line's midpoint
        // (the center) - a label glued to dead center could never be dragged
        // clear of the circle.
        expect(geometry.labelPosition.x).toBeCloseTo(8, 6);
        expect(geometry.labelPosition.y).toBeCloseTo(4, 6);
    });

    test("diameter labelPosition moves out past the edge as placement is dragged farther", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const onCircle = new XYZ({ x: 5, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 20, z: 0 });

        const geometry = computeRadialDimensionGeometry(center, onCircle, placement, "diameter");

        // Follows placement's direction and distance, same as radial's line[1] -
        // clear of the circle (radius 5), not stuck at the center.
        expect(geometry.labelPosition.x).toBeCloseTo(0, 6);
        expect(geometry.labelPosition.y).toBeCloseTo(20, 6);
    });
});

describe("computeAngleDimensionGeometry", () => {
    test("should measure 90 degrees between perpendicular edges", () => {
        const vertex = XYZ.zero;
        const point1 = new XYZ({ x: 10, y: 0, z: 0 });
        const point2 = new XYZ({ x: 0, y: 10, z: 0 });
        const placement = new XYZ({ x: 3, y: 3, z: 0 });

        const geometry = computeAngleDimensionGeometry(vertex, point1, point2, placement);

        expect(geometry.value).toBeCloseTo(90, 6);
    });

    test("should measure 60 degrees between edges 60 degrees apart", () => {
        const vertex = XYZ.zero;
        const point1 = new XYZ({ x: 10, y: 0, z: 0 });
        const angle = Math.PI / 3;
        const point2 = new XYZ({ x: 10 * Math.cos(angle), y: 10 * Math.sin(angle), z: 0 });
        const placement = new XYZ({ x: 5, y: 1, z: 0 });

        const geometry = computeAngleDimensionGeometry(vertex, point1, point2, placement);

        expect(geometry.value).toBeCloseTo(60, 6);
    });

    test("arc should start and end at radius from the vertex, along each edge's direction", () => {
        const vertex = new XYZ({ x: 1, y: 2, z: 0 });
        const point1 = vertex.add(new XYZ({ x: 10, y: 0, z: 0 }));
        const point2 = vertex.add(new XYZ({ x: 0, y: 10, z: 0 }));
        const placement = vertex.add(new XYZ({ x: 0, y: 5, z: 0 }));

        const geometry = computeAngleDimensionGeometry(vertex, point1, point2, placement);

        const radius = vertex.distanceTo(placement);
        const arcStart = geometry.arcPoints[0];
        const arcEnd = geometry.arcPoints[geometry.arcPoints.length - 1];
        expect(vertex.distanceTo(arcStart)).toBeCloseTo(radius, 6);
        expect(vertex.distanceTo(arcEnd)).toBeCloseTo(radius, 6);
        expect(arcStart.isEqualTo(vertex.add(new XYZ({ x: radius, y: 0, z: 0 })), 1e-6)).toBe(true);
        expect(arcEnd.isEqualTo(vertex.add(new XYZ({ x: 0, y: radius, z: 0 })), 1e-6)).toBe(true);
    });

    test("labelPosition should sit on the arc at the angle bisector", () => {
        const vertex = XYZ.zero;
        const point1 = new XYZ({ x: 10, y: 0, z: 0 });
        const point2 = new XYZ({ x: 0, y: 10, z: 0 });
        const placement = new XYZ({ x: 0, y: 5, z: 0 });

        const geometry = computeAngleDimensionGeometry(vertex, point1, point2, placement);

        const radius = vertex.distanceTo(placement);
        const expectedBisector = new XYZ({
            x: (radius * Math.SQRT2) / 2,
            y: (radius * Math.SQRT2) / 2,
            z: 0,
        });
        expect(geometry.labelPosition.isEqualTo(expectedBisector, 1e-6)).toBe(true);
    });

    test("should fall back to a default radius when placement coincides with the vertex", () => {
        const vertex = XYZ.zero;
        const point1 = new XYZ({ x: 10, y: 0, z: 0 });
        const point2 = new XYZ({ x: 0, y: 10, z: 0 });

        const geometry = computeAngleDimensionGeometry(vertex, point1, point2, vertex);

        expect(Number.isFinite(geometry.arcPoints[0].x)).toBe(true);
        expect(vertex.distanceTo(geometry.arcPoints[0])).toBeGreaterThan(0);
    });

    test("should not crash when a point coincides with the vertex (degenerate direction)", () => {
        const vertex = new XYZ({ x: 1, y: 1, z: 0 });
        const point1 = new XYZ({ x: 10, y: 0, z: 0 });
        const placement = new XYZ({ x: 5, y: 5, z: 0 });

        const geometry = computeAngleDimensionGeometry(vertex, point1, vertex, placement);

        expect(Number.isFinite(geometry.value)).toBe(true);
        expect(geometry.arcPoints.length).toBeGreaterThan(0);
    });

    test("outward radial directions at each arc end point away from the vertex", () => {
        const vertex = XYZ.zero;
        const point1 = new XYZ({ x: 10, y: 0, z: 0 });
        const point2 = new XYZ({ x: 0, y: 10, z: 0 });
        const placement = new XYZ({ x: 0, y: 5, z: 0 });

        const geometry = computeAngleDimensionGeometry(vertex, point1, point2, placement);

        expect(geometry.startPerp.isEqualTo(XYZ.unitX, 1e-6)).toBe(true);
        expect(geometry.endPerp.isEqualTo(XYZ.unitY, 1e-6)).toBe(true);
    });
});
