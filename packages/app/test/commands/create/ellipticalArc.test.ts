// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Plane, Result, XYZ } from "@chili3d/core";
import { createMockDocument } from "@chili3d/core/test-utils";
import { afterEach, describe, expect, test } from "@rstest/core";
import { EllipticalArcNode } from "../../../src/bodys/ellipticalArc";
import { EllipticalArc } from "../../../src/commands/create/ellipticalArc";
import { pointStepResult, seedStepDatas, wireCommand } from "../commandTestUtils";

/**
 * ensureGlobalStubApp() (used elsewhere) returns a shape with no `.curve`,
 * which this command needs (it reads full.value.curve.trim/parameter). Stub
 * `globalThis.app` directly with a fake ellipse edge whose curve's
 * `parameter()` returns the picked point's angle around the origin (in the
 * XY plane, matching this test's seeded points) - good enough to verify the
 * command derives start/end parameters correctly without modeling real
 * OCCT ellipse math.
 */
function stubEllipseFactory(): () => void {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "app");
    const fakeCurve = {
        project: (point: XYZ) => [point],
        parameter: (point: XYZ) => Math.atan2(point.y, point.x),
        trim: (u1: number, u2: number) => ({ u1, u2, kind: "trimmed" }),
    };
    const fakeEdge = {
        curve: fakeCurve,
        dispose: () => {},
        edgesMeshPosition: () => ({ type: "edges", positions: [] }),
        isClosed: () => false,
        isNull: () => false,
    };
    const methods = {
        ellipse: () => Result.ok(fakeEdge),
        edge: (curve: unknown) => ({ builtFrom: curve }),
    };
    const stubApp = { shapeProvider: { factory: methods, converter: {} } } as any;
    Object.defineProperty(globalThis, "app", {
        configurable: true,
        get: () => stubApp,
    });
    return () => {
        if (previous) Object.defineProperty(globalThis, "app", previous);
    };
}

let restore: () => void;
afterEach(() => restore?.());

describe("EllipticalArc", () => {
    test("should have command metadata", () => {
        const data = (EllipticalArc as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.ellipticalArc");
        expect(data.icon).toBe("icon-ellipse");
    });

    test("getSteps should return five steps", () => {
        const cmd = new EllipticalArc();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(5);
    });

    function cmdWithSteps(): EllipticalArc {
        const cmd = new EllipticalArc();
        wireCommand(cmd);
        seedStepDatas(cmd, [
            pointStepResult({ point: XYZ.zero }),
            pointStepResult({ point: new XYZ({ x: 10, y: 0, z: 0 }), plane: Plane.XY }),
            pointStepResult({ point: new XYZ({ x: 0, y: 5, z: 0 }) }),
            // Start point at angle 0 (along +X, on the major axis).
            pointStepResult({ point: new XYZ({ x: 10, y: 0, z: 0 }) }),
            // End point at angle 90deg (along +Y).
            pointStepResult({ point: new XYZ({ x: 0, y: 5, z: 0 }) }),
        ]);
        return cmd;
    }

    describe("ellipseParams", () => {
        test("derives center/xvec/radii from the first three picks", () => {
            const cmd = cmdWithSteps();
            const params = (cmd as any).ellipseParams();
            expect(params.center.isEqualTo(XYZ.zero)).toBe(true);
            expect(params.majorRadius).toBeCloseTo(10);
            expect(params.minorRadius).toBeCloseTo(5);
        });
    });

    describe("ellipsePreview (live preview during step 2, before it's finalized)", () => {
        // Regression test: ellipsePreview used to call ellipseParams() with no
        // argument, which unconditionally read stepDatas[2].point - but while
        // the user is still dragging to pick the minor radius, stepDatas[2]
        // doesn't exist yet (only the live mouse position, passed as the
        // callback's own parameter). That crashed the app mid-draw.
        test("does not touch stepDatas[2] and renders from the live point instead", () => {
            restore = stubEllipseFactory();
            const cmd = new EllipticalArc();
            wireCommand(cmd);
            seedStepDatas(cmd, [
                pointStepResult({ point: XYZ.zero }),
                pointStepResult({ point: new XYZ({ x: 10, y: 0, z: 0 }), plane: Plane.XY }),
                // No third entry - step 2 (minor radius) is still in progress.
            ]);

            const preview = (cmd as any).ellipsePreview(new XYZ({ x: 0, y: 5, z: 0 }));
            expect(preview).toHaveLength(3);
        });
    });

    describe("geometryNode", () => {
        test("builds an EllipticalArcNode with parameters from the picked start/end points", () => {
            restore = stubEllipseFactory();
            const cmd = cmdWithSteps();

            const node = (cmd as any).geometryNode();

            expect(node).toBeInstanceOf(EllipticalArcNode);
            expect(node.majorRadius).toBeCloseTo(10);
            expect(node.minorRadius).toBeCloseTo(5);
            expect(node.startParameter).toBeCloseTo(0);
            expect(node.endParameter).toBeCloseTo(Math.PI / 2);
        });
    });

    describe("EllipticalArcNode.generateShape", () => {
        test("trims the full ellipse from the smaller to the larger parameter", () => {
            restore = stubEllipseFactory();
            const node = new EllipticalArcNode({
                document: createMockDocument(),
                normal: XYZ.unitZ,
                center: XYZ.zero,
                xvec: XYZ.unitX,
                majorRadius: 10,
                minorRadius: 5,
                // Passed in reverse order on purpose - generateShape should sort them.
                startParameter: Math.PI / 2,
                endParameter: 0,
            });

            const result = node.generateShape();
            expect(result.isOk).toBe(true);
            const built = (result.value as any).builtFrom;
            expect(built.u1).toBeCloseTo(0);
            expect(built.u2).toBeCloseTo(Math.PI / 2);
        });
    });
});
