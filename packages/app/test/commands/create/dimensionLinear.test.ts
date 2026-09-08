// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { DimensionAnnotation, getDimensionEditHandler, XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { LineNode } from "../../../src/bodys";
import { LinearDimension } from "../../../src/commands/create/dimensionLinear";
import {
    ensureGlobalStubApp,
    pointStepResult,
    seedStepDatas,
    shapeData,
    wireCommand,
} from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("LinearDimension", () => {
    test("should have command metadata", () => {
        const data = (LinearDimension as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.dimensionLinear");
        expect(data.icon).toBe("icon-measureLength");
    });

    test("getSteps should return three steps", () => {
        const cmd = new LinearDimension();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(3);
    });

    function ownedPointStep(point: XYZ, node?: unknown) {
        const step = pointStepResult({ point });
        if (node) step.shapes = [shapeData({ node })];
        return step;
    }

    function cmdWithPoints(
        p0: XYZ,
        p1: XYZ,
        placement: XYZ,
        owners: [unknown?, unknown?] = [],
    ): LinearDimension {
        const cmd = new LinearDimension();
        wireCommand(cmd);
        seedStepDatas(cmd, [
            ownedPointStep(p0, owners[0]),
            ownedPointStep(p1, owners[1]),
            pointStepResult({ point: placement }),
        ]);
        return cmd;
    }

    describe("getSecondPointData", () => {
        test("should expose refPoint, dimension, validator, and preview", () => {
            const cmd = cmdWithPoints(
                XYZ.zero,
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 5, z: 0 }),
            );
            const data = (cmd as any).getSecondPointData();
            expect(typeof data.refPoint).toBe("function");
            expect(typeof data.validator).toBe("function");
            expect(typeof data.preview).toBe("function");
        });

        test("validator should reject a coincident point and accept a distinct one", () => {
            const cmd = cmdWithPoints(
                XYZ.zero,
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 5, z: 0 }),
            );
            const data = (cmd as any).getSecondPointData();
            expect(data.validator(XYZ.zero)).toBe(false);
            expect(data.validator(new XYZ({ x: 1, y: 0, z: 0 }))).toBe(true);
        });
    });

    describe("segmentPreview", () => {
        test("should render only the first point when new point is undefined", () => {
            const cmd = cmdWithPoints(
                XYZ.zero,
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 5, z: 0 }),
            );
            const preview = (cmd as any).segmentPreview(undefined);
            expect(preview).toHaveLength(1);
        });

        test("should render the first point and a line when a point is given", () => {
            const cmd = cmdWithPoints(
                XYZ.zero,
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 5, z: 0 }),
            );
            const preview = (cmd as any).segmentPreview(new XYZ({ x: 5, y: 0, z: 0 }));
            expect(preview).toHaveLength(2);
        });
    });

    describe("placementPreview", () => {
        test("should render the measured segment, plus a leader line once placement moves", () => {
            const cmd = cmdWithPoints(
                XYZ.zero,
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 5, y: 5, z: 0 }),
            );
            expect((cmd as any).placementPreview(undefined)).toHaveLength(1);
            expect((cmd as any).placementPreview(new XYZ({ x: 5, y: 5, z: 0 }))).toHaveLength(2);
        });
    });

    describe("executeMainTask", () => {
        test("should add a linear DimensionAnnotation to the document", () => {
            const p0 = new XYZ({ x: 0, y: 0, z: 0 });
            const p1 = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                ownedPointStep(p0),
                ownedPointStep(p1),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            expect(addedNodes).toHaveLength(1);
            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation).toBeInstanceOf(DimensionAnnotation);
            expect(annotation.dimensionType).toBe("linear");
            expect(annotation.startPoint).toEqual(p0);
            expect(annotation.endPoint).toEqual(p1);
            expect(annotation.placement).toEqual(placement);
            expect((cmd as any).repeatOperation).toBe(true);
        });

        test("should not register an edit handler when the points don't belong to a shared LineNode", () => {
            const p0 = new XYZ({ x: 0, y: 0, z: 0 });
            const p1 = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                ownedPointStep(p0),
                ownedPointStep(p1),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(getDimensionEditHandler(annotation)).toBeUndefined();
        });

        test("should register a working edit handler when both points are a LineNode's endpoints", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const line = new LineNode({ document: doc, start, end });
            seedStepDatas(cmd, [
                ownedPointStep(start, line),
                ownedPointStep(end, line),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation);
            expect(handler).toBeDefined();

            const accepted = handler!(20);
            expect(accepted).toBe(true);
            expect(line.end.isEqualTo(new XYZ({ x: 20, y: 0, z: 0 }), 1e-6)).toBe(true);
            expect(line.start).toEqual(start);

            // The annotation's own endPoint must track the line's new
            // endpoint too, or the rendered dimension goes stale after an
            // edit even though the underlying line moved.
            expect(annotation.endPoint.isEqualTo(new XYZ({ x: 20, y: 0, z: 0 }), 1e-6)).toBe(true);
            expect(annotation.startPoint).toEqual(start);
        });

        test("edit handler should move the pinned-at-end endpoint when points are picked in reverse order", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const line = new LineNode({ document: doc, start, end });
            seedStepDatas(cmd, [
                ownedPointStep(end, line),
                ownedPointStep(start, line),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation)!;

            expect(handler(4)).toBe(true);
            expect(line.start.isEqualTo(new XYZ({ x: 6, y: 0, z: 0 }), 1e-6)).toBe(true);
            expect(line.end).toEqual(end);
        });

        test("edit handler should reject a non-positive length", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const line = new LineNode({ document: doc, start, end });
            seedStepDatas(cmd, [
                ownedPointStep(start, line),
                ownedPointStep(end, line),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation)!;

            expect(handler(0)).toBe(false);
            expect(line.end).toEqual(end);
        });

        test("should not register an edit handler when the two points belong to different LineNodes", () => {
            const doc = { modelManager: { materials: [] } };
            const lineA = new LineNode({
                document: doc as any,
                start: XYZ.zero,
                end: new XYZ({ x: 10, y: 0, z: 0 }),
            });
            const lineB = new LineNode({
                document: doc as any,
                start: new XYZ({ x: 0, y: 10, z: 0 }),
                end: new XYZ({ x: 10, y: 10, z: 0 }),
            });

            const p0 = new XYZ({ x: 0, y: 0, z: 0 });
            const p1 = new XYZ({ x: 0, y: 10, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new LinearDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                ownedPointStep(p0, lineA),
                ownedPointStep(p1, lineB),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(getDimensionEditHandler(annotation)).toBeUndefined();
        });
    });
});
