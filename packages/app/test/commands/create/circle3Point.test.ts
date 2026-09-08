// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { CircleNode } from "../../../src/bodys";
import { Circle3Point } from "../../../src/commands/create/circle3Point";
import { ensureGlobalStubApp, pointStepResult, seedStepDatas, wireCommand } from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("Circle3Point", () => {
    test("should have command metadata", () => {
        const data = (Circle3Point as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.circle3Point");
        expect(data.icon).toBe("icon-circle");
    });

    test("isFace should default to true", () => {
        const cmd = new Circle3Point();
        expect(cmd.isFace).toBe(true);
    });

    test("getSteps should return three steps", () => {
        const cmd = new Circle3Point();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(3);
    });

    function cmdWithPoints(p0: XYZ, p1: XYZ, p2: XYZ): Circle3Point {
        const cmd = new Circle3Point();
        wireCommand(cmd);
        seedStepDatas(cmd, [
            pointStepResult({ point: p0 }),
            pointStepResult({ point: p1 }),
            pointStepResult({ point: p2 }),
        ]);
        return cmd;
    }

    describe("geometryNode", () => {
        test("should build a CircleNode through the three picked points", () => {
            // A circle of radius 5 centered at the origin, in the XY plane.
            const p0 = new XYZ({ x: 5, y: 0, z: 0 });
            const p1 = new XYZ({ x: 0, y: 5, z: 0 });
            const p2 = new XYZ({ x: -5, y: 0, z: 0 });
            const cmd = cmdWithPoints(p0, p1, p2);
            const node = (cmd as any).geometryNode();

            expect(node).toBeInstanceOf(CircleNode);
            expect(node.radius).toBeCloseTo(5, 6);
            expect(node.center.isEqualTo(XYZ.zero, 1e-6)).toBe(true);
            expect(node.isFace).toBe(true);
        });

        test("should honor isFace=false", () => {
            const p0 = new XYZ({ x: 5, y: 0, z: 0 });
            const p1 = new XYZ({ x: 0, y: 5, z: 0 });
            const p2 = new XYZ({ x: -5, y: 0, z: 0 });
            const cmd = cmdWithPoints(p0, p1, p2);
            cmd.isFace = false;
            const node = (cmd as any).geometryNode();
            expect(node.isFace).toBe(false);
        });
    });

    describe("getThirdPointData validator", () => {
        test("should reject a third point collinear with the first two", () => {
            const p0 = new XYZ({ x: 0, y: 0, z: 0 });
            const p1 = new XYZ({ x: 5, y: 0, z: 0 });
            const cmd = cmdWithPoints(p0, p1, p0);
            const data = (cmd as any).getThirdPointData();
            expect(data.validator(new XYZ({ x: 10, y: 0, z: 0 }))).toBe(false);
        });

        test("should accept a third point that forms a proper triangle", () => {
            const p0 = new XYZ({ x: 0, y: 0, z: 0 });
            const p1 = new XYZ({ x: 5, y: 0, z: 0 });
            const cmd = cmdWithPoints(p0, p1, p0);
            const data = (cmd as any).getThirdPointData();
            expect(data.validator(new XYZ({ x: 0, y: 5, z: 0 }))).toBe(true);
        });
    });

    describe("circlePreview", () => {
        test("should render just the two picked points when no point is given", () => {
            const cmd = cmdWithPoints(
                new XYZ({ x: 0, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 0, z: 0 }),
                new XYZ({ x: 0, y: 0, z: 0 }),
            );
            const preview = (cmd as any).circlePreview(undefined);
            expect(preview).toHaveLength(2);
        });

        test("should render the circle once a valid third point is given", () => {
            const cmd = cmdWithPoints(
                new XYZ({ x: 0, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 0, z: 0 }),
                new XYZ({ x: 0, y: 0, z: 0 }),
            );
            const preview = (cmd as any).circlePreview(new XYZ({ x: 0, y: 5, z: 0 }));
            expect(preview).toHaveLength(4);
        });
    });
});
