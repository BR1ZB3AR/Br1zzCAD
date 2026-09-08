// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { LineNode } from "../../../src/bodys";
import { LineMidpoint } from "../../../src/commands/create/lineMidpoint";
import { ensureGlobalStubApp, pointStepResult, seedStepDatas, wireCommand } from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("LineMidpoint", () => {
    test("should have command metadata", () => {
        const data = (LineMidpoint as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.lineMidpoint");
        expect(data.icon).toBe("icon-line");
    });

    test("getSteps should return two steps", () => {
        const cmd = new LineMidpoint();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    function cmdWithPoints(mid: XYZ, pick: XYZ): LineMidpoint {
        const cmd = new LineMidpoint();
        wireCommand(cmd);
        seedStepDatas(cmd, [pointStepResult({ point: mid }), pointStepResult({ point: pick })]);
        return cmd;
    }

    describe("geometryNode", () => {
        test("should build a LineNode symmetric about the picked midpoint", () => {
            const mid = new XYZ({ x: 0, y: 0, z: 0 });
            const pick = new XYZ({ x: 10, y: 0, z: 0 });
            const cmd = cmdWithPoints(mid, pick);
            const node = (cmd as any).geometryNode();

            expect(node).toBeInstanceOf(LineNode);
            expect(node.start.isEqualTo(new XYZ({ x: -10, y: 0, z: 0 }))).toBe(true);
            expect(node.end.isEqualTo(new XYZ({ x: 10, y: 0, z: 0 }))).toBe(true);
        });

        test("should work for an off-origin midpoint", () => {
            const mid = new XYZ({ x: 5, y: 5, z: 0 });
            const pick = new XYZ({ x: 8, y: 5, z: 0 });
            const cmd = cmdWithPoints(mid, pick);
            const node = (cmd as any).geometryNode();

            expect(node.start.isEqualTo(new XYZ({ x: 2, y: 5, z: 0 }))).toBe(true);
            expect(node.end.isEqualTo(new XYZ({ x: 8, y: 5, z: 0 }))).toBe(true);
        });
    });

    describe("getSecondPointData", () => {
        test("validator should reject a point coincident with the midpoint", () => {
            const cmd = cmdWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const data = (cmd as any).getSecondPointData();
            expect(data.validator(new XYZ({ x: 0, y: 0, z: 0 }))).toBe(false);
        });

        test("validator should accept a distinct point", () => {
            const cmd = cmdWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const data = (cmd as any).getSecondPointData();
            expect(data.validator(new XYZ({ x: 5, y: 0, z: 0 }))).toBe(true);
        });
    });

    describe("linePreview", () => {
        test("should render only the midpoint marker when no point is given", () => {
            const cmd = cmdWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const preview = (cmd as any).linePreview(undefined);
            expect(preview).toHaveLength(1);
        });

        test("should render the midpoint and the symmetric line when a point is given", () => {
            const cmd = cmdWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const preview = (cmd as any).linePreview(new XYZ({ x: 4, y: 0, z: 0 }));
            expect(preview).toHaveLength(2);
        });
    });
});
