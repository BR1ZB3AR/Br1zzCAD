// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Plane, XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { RectNode } from "../../../src/bodys/rect";
import { CenterRect } from "../../../src/commands/create/centerRect";
import { ensureGlobalStubApp, pointStepResult, seedStepDatas, wireCommand } from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("CenterRect", () => {
    test("should have command metadata", () => {
        const data = (CenterRect as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.centerRect");
        expect(data.icon).toBe("icon-rect");
    });

    test("isFace should default to true", () => {
        const cmd = new CenterRect();
        expect(cmd.isFace).toBe(true);
    });

    test("isFace setter should update property", () => {
        const cmd = new CenterRect();
        cmd.isFace = false;
        expect(cmd.isFace).toBe(false);
    });

    test("getSteps should return two steps", () => {
        const cmd = new CenterRect();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    function rectCmd(center: XYZ, corner: XYZ, opts: { type?: "input" | "feature"; plane?: Plane } = {}) {
        const cmd = new CenterRect();
        wireCommand(cmd);
        seedStepDatas(cmd, [
            pointStepResult({ point: center }),
            pointStepResult({ point: corner, type: opts.type ?? "input", plane: opts.plane }),
        ]);
        return cmd;
    }

    describe("geometryNode", () => {
        test("is always centered on the first point (input step: no doubling)", () => {
            const cmd = rectCmd(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 5, y: 3, z: 0 }), {
                type: "input",
                plane: Plane.XY,
            });
            const node = (cmd as any).geometryNode();

            expect(node).toBeInstanceOf(RectNode);
            expect(node.dx).toBeCloseTo(5, 6);
            expect(node.dy).toBeCloseTo(3, 6);
            // Centered on the origin -> plane origin shifted to (-2.5, -1.5).
            expect(node.plane.origin.x).toBeCloseTo(-2.5, 6);
            expect(node.plane.origin.y).toBeCloseTo(-1.5, 6);
        });

        test("doubles dx/dy for a non-input (feature) second step, still centered", () => {
            const cmd = rectCmd(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 5, y: 3, z: 0 }), {
                type: "feature",
                plane: Plane.XY,
            });
            const node = (cmd as any).geometryNode();

            expect(node.dx).toBeCloseTo(10, 6);
            expect(node.dy).toBeCloseTo(6, 6);
            expect(node.plane.origin.x).toBeCloseTo(-5, 6);
            expect(node.plane.origin.y).toBeCloseTo(-3, 6);
        });

        test("should honor isFace=false", () => {
            const cmd = rectCmd(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 2, y: 2, z: 0 }), {
                type: "input",
                plane: Plane.XY,
            });
            cmd.isFace = false;
            const node = (cmd as any).geometryNode();
            expect(node.isFace).toBe(false);
        });
    });
});
