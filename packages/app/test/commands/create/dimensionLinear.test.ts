// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { DimensionAnnotation, getDimensionEditHandler, XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { LineNode, RectNode } from "../../../src/bodys";
import { LinearDimension } from "../../../src/commands/create/dimensionLinear";
import {
    ensureGlobalStubApp,
    PLANE_XY,
    pointStepResult,
    seedStepDatas,
    shapeStepResult,
    wireCommand,
} from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

/** A stand-in edge shape whose `.curve` looks like a straight line segment
 * between `start` and `end` - matches what `LinearDimension.executeMainTask`
 * reads (`curve.startPoint()`/`curve.endPoint()`), without a real WASM edge.
 * `node`, if given, becomes `shapes[0].owner.node` for edit-handler tests. */
function lineEdgeStep(start: XYZ, end: XYZ, node?: unknown) {
    return shapeStepResult([
        {
            shape: {
                curve: {
                    startPoint: () => start,
                    endPoint: () => end,
                    basisCurve: { direction: end.sub(start).normalize() },
                },
            } as any,
            node,
        },
    ]);
}

describe("LinearDimension", () => {
    test("should have command metadata", () => {
        const data = (LinearDimension as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.dimensionLinear");
        expect(data.icon).toBe("icon-measureLength");
    });

    test("getSteps should return two steps", () => {
        const cmd = new LinearDimension();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    describe("executeMainTask", () => {
        test("should add a linear DimensionAnnotation spanning the picked edge", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [lineEdgeStep(start, end), pointStepResult({ point: placement })]);

            (cmd as any).executeMainTask();

            expect(addedNodes).toHaveLength(1);
            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation).toBeInstanceOf(DimensionAnnotation);
            expect(annotation.dimensionType).toBe("linear");
            expect(annotation.startPoint).toEqual(start);
            expect(annotation.endPoint).toEqual(end);
            expect(annotation.placement).toEqual(placement);
            expect((cmd as any).repeatOperation).toBe(true);
        });

        test("should not register an edit handler when the edge has no owner node", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [lineEdgeStep(start, end), pointStepResult({ point: placement })]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(getDimensionEditHandler(annotation)).toBeUndefined();
        });

        test("should register a working edit handler when the edge belongs to a LineNode", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const line = new LineNode({ document: doc, start, end });
            seedStepDatas(cmd, [lineEdgeStep(start, end, line), pointStepResult({ point: placement })]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation);
            expect(handler).toBeDefined();

            expect(handler!(20)).toBe(true);
            expect(line.end.isEqualTo(new XYZ({ x: 20, y: 0, z: 0 }), 1e-6)).toBe(true);
            expect(annotation.endPoint.isEqualTo(new XYZ({ x: 20, y: 0, z: 0 }), 1e-6)).toBe(true);
        });

        test("should register a working edit handler when the edge belongs to a RectNode", () => {
            const dx = 10;
            const dy = 6;
            const cmd = new LinearDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const rect = new RectNode({ document: doc, plane: PLANE_XY, dx, dy });
            const corners = RectNode.points(PLANE_XY, dx, dy);
            const placement = new XYZ({ x: 5, y: -5, z: 0 });
            seedStepDatas(cmd, [
                lineEdgeStep(corners[0], corners[1], rect),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation);
            expect(handler).toBeDefined();

            expect(handler!(25)).toBe(true);
            expect(rect.dx).toBe(25);
            expect(rect.dy).toBe(6);
        });
    });
});
