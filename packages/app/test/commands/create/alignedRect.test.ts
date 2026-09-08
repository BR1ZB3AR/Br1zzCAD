// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { RectNode } from "../../../src/bodys/rect";
import { AlignedRect } from "../../../src/commands/create/alignedRect";
import { ensureGlobalStubApp, pointStepResult, seedStepDatas, wireCommand } from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("AlignedRect", () => {
    test("should have command metadata", () => {
        const data = (AlignedRect as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.alignedRect");
        expect(data.icon).toBe("icon-rect");
    });

    test("isFace should default to true", () => {
        const cmd = new AlignedRect();
        expect(cmd.isFace).toBe(true);
    });

    test("getSteps should return three steps", () => {
        const cmd = new AlignedRect();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(3);
    });

    function cmdWithPoints(corner: XYZ, edgeEnd: XYZ, widthPoint: XYZ): AlignedRect {
        const cmd = new AlignedRect();
        wireCommand(cmd);
        seedStepDatas(cmd, [
            pointStepResult({ point: corner }),
            pointStepResult({ point: edgeEnd }),
            pointStepResult({ point: widthPoint }),
        ]);
        return cmd;
    }

    describe("geometryNode", () => {
        test("should build an axis-aligned rect when the edge runs along X", () => {
            const cmd = cmdWithPoints(
                new XYZ({ x: 0, y: 0, z: 0 }),
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 0, y: 4, z: 0 }),
            );
            const node = (cmd as any).geometryNode();

            expect(node).toBeInstanceOf(RectNode);
            expect(node.dx).toBeCloseTo(10, 6);
            expect(node.dy).toBeCloseTo(4, 6);
            expect(node.plane.xvec.isEqualTo(new XYZ({ x: 1, y: 0, z: 0 }))).toBe(true);
        });

        test("should rotate the rect to follow a non-axis-aligned edge", () => {
            // Edge from origin to (10,10,0): a 45-degree edge, length ~14.142.
            const cmd = cmdWithPoints(
                new XYZ({ x: 0, y: 0, z: 0 }),
                new XYZ({ x: 10, y: 10, z: 0 }),
                new XYZ({ x: -5, y: 5, z: 0 }),
            );
            const node = (cmd as any).geometryNode();

            expect(node.dx).toBeCloseTo(Math.sqrt(200), 4);
            const expectedX = Math.SQRT1_2;
            expect(node.plane.xvec.x).toBeCloseTo(expectedX, 4);
            expect(node.plane.xvec.y).toBeCloseTo(expectedX, 4);
        });

        test("should honor isFace=false", () => {
            const cmd = cmdWithPoints(
                new XYZ({ x: 0, y: 0, z: 0 }),
                new XYZ({ x: 2, y: 0, z: 0 }),
                new XYZ({ x: 0, y: 2, z: 0 }),
            );
            cmd.isFace = false;
            const node = (cmd as any).geometryNode();
            expect(node.isFace).toBe(false);
        });
    });

    describe("getWidthPointData validator", () => {
        test("should reject a width point that lands back on the edge line (zero dy)", () => {
            const cmd = cmdWithPoints(
                new XYZ({ x: 0, y: 0, z: 0 }),
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 0, z: 0 }),
            );
            const data = (cmd as any).getWidthPointData();
            expect(data.validator(new XYZ({ x: 5, y: 0, z: 0 }))).toBe(false);
        });

        test("should accept a width point off the edge line", () => {
            const cmd = cmdWithPoints(
                new XYZ({ x: 0, y: 0, z: 0 }),
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 3, z: 0 }),
            );
            const data = (cmd as any).getWidthPointData();
            expect(data.validator(new XYZ({ x: 5, y: 3, z: 0 }))).toBe(true);
        });
    });
});
