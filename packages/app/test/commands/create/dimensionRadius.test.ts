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
import { CircleNode } from "../../../src/bodys";
import { DiameterDimension, RadiusDimension } from "../../../src/commands/create/dimensionRadius";
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

/** A stand-in edge shape whose `.curve.basisCurve` looks like an OCCT circle -
 * matches what `circleFromEdge` (dimensionUtils.ts) reads, without needing a
 * real WASM edge. */
function circleEdgeShape(center: XYZ, radius: number, xAxis: XYZ = XYZ.unitX): Partial<IShape> {
    return {
        curve: {
            basisCurve: { center, radius, xAxis },
        },
    } as unknown as Partial<IShape>;
}

describe("RadiusDimension", () => {
    test("should have command metadata", () => {
        const data = (RadiusDimension as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.dimensionRadius");
        expect(data.icon).toBe("icon-measureLength");
    });

    test("dimensionType should be radial", () => {
        const cmd = new RadiusDimension();
        expect((cmd as any).dimensionType).toBe("radial");
    });

    test("getSteps should return two steps", () => {
        const cmd = new RadiusDimension();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    describe("executeMainTask", () => {
        test("should add a radial DimensionAnnotation sized from the picked circle", () => {
            const center = new XYZ({ x: 0, y: 0, z: 0 });
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const cmd = new RadiusDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: circleEdgeShape(center, 5) }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            expect(addedNodes).toHaveLength(1);
            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(annotation.dimensionType).toBe("radial");
            expect(annotation.startPoint).toEqual(center);
            expect(annotation.endPoint.isEqualTo(new XYZ({ x: 5, y: 0, z: 0 }), 1e-6)).toBe(true);
            expect((cmd as any).repeatOperation).toBe(true);
        });

        test("should do nothing when the picked edge isn't circular", () => {
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const cmd = new RadiusDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: { curve: { basisCurve: {} } } as unknown as Partial<IShape> }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            expect(addedNodes).toHaveLength(0);
        });

        test("should not register an edit handler for a circular edge with no CircleNode owner", () => {
            const center = new XYZ({ x: 0, y: 0, z: 0 });
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const cmd = new RadiusDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: circleEdgeShape(center, 5) }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(getDimensionEditHandler(annotation)).toBeUndefined();
        });

        test("should register an edit handler that writes the new radius back to the owning CircleNode", () => {
            const center = new XYZ({ x: 0, y: 0, z: 0 });
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const cmd = new RadiusDimension();
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

            // The annotation's own endPoint must track the new radius too,
            // or the rendered radial line goes stale after an edit even
            // though the underlying circle grew/shrank.
            expect(annotation.endPoint.isEqualTo(new XYZ({ x: 8, y: 0, z: 0 }), 1e-6)).toBe(true);
        });

        test("edit handler should reject a non-positive radius", () => {
            const center = new XYZ({ x: 0, y: 0, z: 0 });
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const cmd = new RadiusDimension();
            const { doc, addedNodes } = wireCommand(cmd);
            const circleNode = new CircleNode({ document: doc, normal: XYZ.unitZ, center, radius: 5 });
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: circleEdgeShape(center, 5), node: circleNode }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            const handler = getDimensionEditHandler(annotation)!;

            expect(handler(0)).toBe(false);
            expect(circleNode.radius).toBe(5);
        });

        test("should register the edge's owner as a measured node even when it's not a CircleNode", () => {
            const center = new XYZ({ x: 0, y: 0, z: 0 });
            const placement = new XYZ({ x: 0, y: 10, z: 0 });
            const owner = {}; // e.g. an Arc's circular edge - not editable, but should still be tracked
            const cmd = new RadiusDimension();
            const { addedNodes } = wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([{ shape: circleEdgeShape(center, 5), node: owner }]),
                pointStepResult({ point: placement }),
            ]);

            (cmd as any).executeMainTask();

            const annotation = addedNodes[0] as DimensionAnnotation;
            expect(getDimensionMeasuredNodes(annotation)).toEqual([owner]);
        });
    });
});

describe("DiameterDimension", () => {
    test("should have command metadata", () => {
        const data = (DiameterDimension as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.dimensionDiameter");
        expect(data.icon).toBe("icon-measureLength");
    });

    test("dimensionType should be diameter", () => {
        const cmd = new DiameterDimension();
        expect((cmd as any).dimensionType).toBe("diameter");
    });

    test("executeMainTask should tag the annotation as a diameter dimension", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 10, z: 0 });
        const cmd = new DiameterDimension();
        const { addedNodes } = wireCommand(cmd);
        seedStepDatas(cmd, [
            shapeStepResult([{ shape: circleEdgeShape(center, 5) }]),
            pointStepResult({ point: placement }),
        ]);

        (cmd as any).executeMainTask();

        const annotation = addedNodes[0] as DimensionAnnotation;
        expect(annotation.dimensionType).toBe("diameter");
    });

    test("edit handler should write radius as half of the entered diameter", () => {
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const placement = new XYZ({ x: 0, y: 10, z: 0 });
        const cmd = new DiameterDimension();
        const { doc, addedNodes } = wireCommand(cmd);
        const circleNode = new CircleNode({ document: doc, normal: XYZ.unitZ, center, radius: 5 });
        seedStepDatas(cmd, [
            shapeStepResult([{ shape: circleEdgeShape(center, 5), node: circleNode }]),
            pointStepResult({ point: placement }),
        ]);

        (cmd as any).executeMainTask();

        const annotation = addedNodes[0] as DimensionAnnotation;
        const handler = getDimensionEditHandler(annotation)!;

        expect(handler(16)).toBe(true);
        expect(circleNode.radius).toBe(8);
    });
});
