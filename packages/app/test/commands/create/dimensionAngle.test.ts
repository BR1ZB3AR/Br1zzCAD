// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { computeAngleDimensionGeometry, DimensionAnnotation, XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { AngleDimension } from "../../../src/commands/create/dimensionAngle";
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

/** A stand-in straight-edge shape whose `.curve.startPoint()`/`.endPoint()`
 * match what `AngleDimension.executeMainTask` reads. */
function lineEdgeShape(start: XYZ, end: XYZ) {
    return {
        curve: {
            startPoint: () => start,
            endPoint: () => end,
            basisCurve: { direction: end.sub(start).normalize() },
        },
    } as any;
}

describe("AngleDimension", () => {
    test("should have command metadata", () => {
        const data = (AngleDimension as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.dimensionAngle");
        expect(data.icon).toBe("icon-measureAngle");
    });

    test("getSteps should return three steps", () => {
        const cmd = new AngleDimension();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(3);
    });

    describe("executeMainTask", () => {
        test("should add an angle DimensionAnnotation measuring the angle between two edges sharing a corner", () => {
            const vertex = new XYZ({ x: 0, y: 0, z: 0 });
            const far1 = new XYZ({ x: 10, y: 0, z: 0 });
            const far2 = new XYZ({ x: 0, y: 10, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new AngleDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: lineEdgeShape(vertex, far1) }]),
                shapeStepResult([{ shape: lineEdgeShape(vertex, far2) }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            expect(addedNodes).toHaveLength(1);
            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation).toBeInstanceOf(DimensionAnnotation);
            expect(annotation.dimensionType).toBe("angle");
            expect(annotation.startPoint.isEqualTo(vertex, 1e-6)).toBe(true);
            expect((cmd as any).repeatOperation).toBe(true);

            const geometry = computeAngleDimensionGeometry(
                annotation.startPoint,
                annotation.endPoint,
                annotation.point2!,
                annotation.placement,
            );
            expect(geometry.value).toBeCloseTo(90, 6);
        });

        test("should pair the shared vertex correctly when edges are picked with opposite winding", () => {
            const vertex = new XYZ({ x: 0, y: 0, z: 0 });
            const far1 = new XYZ({ x: 10, y: 0, z: 0 });
            const far2 = new XYZ({ x: 0, y: 10, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new AngleDimension();
            const { addedNodes } = wireCommand(cmd);
            // Edge 1 picked start->end reversed (far1 -> vertex), edge 2 normal (vertex -> far2).
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: lineEdgeShape(far1, vertex) }]),
                shapeStepResult([{ shape: lineEdgeShape(vertex, far2) }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation.startPoint.isEqualTo(vertex, 1e-6)).toBe(true);
            const geometry = computeAngleDimensionGeometry(
                annotation.startPoint,
                annotation.endPoint,
                annotation.point2!,
                annotation.placement,
            );
            expect(geometry.value).toBeCloseTo(90, 6);
        });

        test("should average near-but-not-exact shared endpoints into a single vertex", () => {
            const vertexA = new XYZ({ x: 0, y: 0, z: 0 });
            const vertexB = new XYZ({ x: 0.001, y: 0, z: 0 });
            const far1 = new XYZ({ x: 10, y: 0, z: 0 });
            const far2 = new XYZ({ x: 0, y: 10, z: 0 });
            const placement = new XYZ({ x: 5, y: 5, z: 0 });
            const cmd = new AngleDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: lineEdgeShape(vertexA, far1) }]),
                shapeStepResult([{ shape: lineEdgeShape(vertexB, far2) }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation.startPoint.x).toBeCloseTo(0.0005, 6);
        });
    });
});
