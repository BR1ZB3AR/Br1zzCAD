// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Plane, XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { RegularPolygonNode } from "../../../src/bodys";
import { CircumscribedPolygon } from "../../../src/commands/create/circumscribedPolygon";
import { ensureGlobalStubApp, pointStepResult, seedStepDatas, wireCommand } from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("CircumscribedPolygon", () => {
    test("should have command metadata", () => {
        const data = (CircumscribedPolygon as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.circumscribedPolygon");
        expect(data.icon).toBe("icon-polygon");
    });

    test("sides should default to 6", () => {
        const cmd = new CircumscribedPolygon();
        expect(cmd.sides).toBe(6);
    });

    test("sides setter should reject values below 3", () => {
        const cmd = new CircumscribedPolygon();
        cmd.sides = 2;
        expect(cmd.sides).toBe(6);
        cmd.sides = 4;
        expect(cmd.sides).toBe(4);
    });

    test("isFace should default to true", () => {
        const cmd = new CircumscribedPolygon();
        expect(cmd.isFace).toBe(true);
    });

    function cmdWithPoints(center: XYZ, apothemPoint: XYZ, sides?: number): CircumscribedPolygon {
        const cmd = new CircumscribedPolygon();
        wireCommand(cmd);
        if (sides !== undefined) cmd.sides = sides;
        seedStepDatas(cmd, [
            pointStepResult({ point: center }),
            pointStepResult({ point: apothemPoint, plane: Plane.XY }),
        ]);
        return cmd;
    }

    describe("geometryNode", () => {
        test("the picked point's distance is the apothem, not the circumradius", () => {
            const center = XYZ.zero;
            const apothem = 10;
            const cmd = cmdWithPoints(center, new XYZ({ x: apothem, y: 0, z: 0 }), 6);
            const node = (cmd as any).geometryNode();

            expect(node).toBeInstanceOf(RegularPolygonNode);
            // For a hexagon, circumradius = apothem / cos(pi/6).
            const expectedCircumradius = apothem / Math.cos(Math.PI / 6);
            expect(node.radius).toBeCloseTo(expectedCircumradius, 6);
            expect(node.sides).toBe(6);
        });

        test("the polygon's edge midpoint (not a vertex) faces the picked direction", () => {
            const center = XYZ.zero;
            const cmd = cmdWithPoints(center, new XYZ({ x: 10, y: 0, z: 0 }), 6);
            const node = (cmd as any).geometryNode();

            const vertices = RegularPolygonNode.calculateVertices(
                node.center,
                node.radius,
                node.sides,
                node.normal,
                node.xvec,
            );
            // The midpoint of the two vertices nearest the pick direction should
            // land back on the picked apothem point (0-distance from it).
            const midpoints = vertices.slice(0, -1).map((v, i) => XYZ.center(v, vertices[i + 1]));
            const closest = midpoints.reduce((best, m) =>
                m.distanceTo(new XYZ({ x: 10, y: 0, z: 0 })) < best.distanceTo(new XYZ({ x: 10, y: 0, z: 0 }))
                    ? m
                    : best,
            );
            expect(closest.distanceTo(new XYZ({ x: 10, y: 0, z: 0 }))).toBeCloseTo(0, 4);
        });

        test("should honor isFace=false", () => {
            const cmd = cmdWithPoints(XYZ.zero, new XYZ({ x: 10, y: 0, z: 0 }));
            cmd.isFace = false;
            const node = (cmd as any).geometryNode();
            expect(node.isFace).toBe(false);
        });
    });
});
