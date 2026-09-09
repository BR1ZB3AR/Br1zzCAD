// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type DimensionAnnotation,
    getDimensionEditHandler,
    getDimensionMeasuredNodes,
    type IShape,
    XYZ,
} from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { CircleNode, LineNode } from "../../../src/bodys";
import { AutoDimension } from "../../../src/commands/create/dimensionAuto";
import {
    ensureGlobalStubApp,
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

function lineEdgeShape(start: XYZ, end: XYZ): Partial<IShape> {
    return {
        curve: {
            startPoint: () => start,
            endPoint: () => end,
            basisCurve: { direction: end.sub(start).normalize() },
        },
    } as unknown as Partial<IShape>;
}

function circleEdgeShape(center: XYZ, radius: number, xAxis: XYZ = XYZ.unitX): Partial<IShape> {
    return {
        curve: {
            basisCurve: { center, radius, xAxis },
        },
    } as unknown as Partial<IShape>;
}

describe("AutoDimension", () => {
    test("should have command metadata", () => {
        const data = (AutoDimension as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.dimensionAuto");
    });

    test("getSteps should return two steps", () => {
        const cmd = new AutoDimension();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    describe("executeMainTask", () => {
        test("should create a linear dimension for a straight edge", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new AutoDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: lineEdgeShape(start, end) }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation.dimensionType).toBe("linear");
            expect(annotation.startPoint).toEqual(start);
            expect(annotation.endPoint).toEqual(end);
            expect((cmd as any).repeatOperation).toBe(true);
        });

        test("should create a radial dimension for a circular edge", () => {
            const center = new XYZ({ x: 0, y: 0, z: 0 });
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const cmd = new AutoDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: circleEdgeShape(center, 5) }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation.dimensionType).toBe("radial");
            expect(annotation.startPoint).toEqual(center);
            expect(annotation.endPoint.isEqualTo(new XYZ({ x: 5, y: 0, z: 0 }), 1e-6)).toBe(true);
        });

        test("should register a working edit handler for a LineNode edge", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new AutoDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const line = new LineNode({ document: doc, start, end });
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: lineEdgeShape(start, end), node: line }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation);
            expect(handler).toBeDefined();

            expect(handler!(20)).toBe(true);
            expect(line.end.isEqualTo(new XYZ({ x: 20, y: 0, z: 0 }), 1e-6)).toBe(true);
        });

        test("should register a working edit handler for a CircleNode edge", () => {
            const center = new XYZ({ x: 0, y: 0, z: 0 });
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const cmd = new AutoDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const circleNode = new CircleNode({ document: doc, normal: XYZ.unitZ, center, radius: 5 });
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: circleEdgeShape(center, 5), node: circleNode }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation);
            expect(handler).toBeDefined();

            expect(handler!(8)).toBe(true);
            expect(circleNode.radius).toBe(8);
        });

        test("should register the edge's owner as a measured node", () => {
            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 10, y: 0, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const owner = {};
            const cmd = new AutoDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: lineEdgeShape(start, end), node: owner }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(getDimensionMeasuredNodes(annotation)).toEqual([owner]);
        });
    });
});
