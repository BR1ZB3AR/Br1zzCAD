// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "../../src/math";
import {
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
});
