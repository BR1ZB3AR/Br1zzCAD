// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { DimensionAnnotation, type IDocument, type IShape, XYZ } from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { LineNode, RectNode } from "../../../src/bodys";
import {
    circleFromEdge,
    circularEdgeFilter,
    lineNodeEditHandler,
    rectNodeEditHandler,
    straightEdgeFilter,
} from "../../../src/commands/create/dimensionUtils";
import { ensureGlobalStubApp, PLANE_XY, wireCommand } from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

/** Editing an annotation's points goes through the same undo-tracked
 * property setters as any other node, so it needs a real wired `doc` (with
 * `history`) - not just enough to satisfy the constructor. `start`/`end`
 * should match whatever's passed to the edit-handler builder under test,
 * mirroring how the real command seeds the annotation from the same points
 * at creation time - otherwise the "anchor" side (which a handler leaves
 * untouched) won't equal the corner it's being compared against. */
function makeAnnotation(doc: IDocument, start: XYZ = XYZ.zero, end: XYZ = XYZ.unitX): DimensionAnnotation {
    return new DimensionAnnotation({
        document: doc,
        annotationType: "dimension",
        name: "Dimension",
        dimensionType: "linear",
        startPoint: start,
        endPoint: end,
        placement: XYZ.unitY,
    });
}

function circleEdgeShape(center: XYZ, radius: number, xAxis: XYZ = XYZ.unitX): Partial<IShape> {
    return {
        curve: { basisCurve: { center, radius, xAxis } },
    } as unknown as Partial<IShape>;
}

function lineEdgeShape(direction: XYZ): Partial<IShape> {
    return {
        curve: { basisCurve: { direction } },
    } as unknown as Partial<IShape>;
}

describe("circleFromEdge / circularEdgeFilter", () => {
    test("circleFromEdge should return the circle when the edge's basisCurve is one", () => {
        const edge = circleEdgeShape(XYZ.zero, 5) as any;
        expect(circleFromEdge(edge)?.radius).toBe(5);
    });

    test("circleFromEdge should return undefined for a non-circular curve", () => {
        const edge = lineEdgeShape(XYZ.unitX) as any;
        expect(circleFromEdge(edge)).toBeUndefined();
    });

    test("circularEdgeFilter should allow circular edges and reject others", () => {
        expect(circularEdgeFilter.allow(circleEdgeShape(XYZ.zero, 5) as any, undefined as any)).toBe(true);
        expect(circularEdgeFilter.allow(lineEdgeShape(XYZ.unitX) as any, undefined as any)).toBe(false);
    });
});

describe("straightEdgeFilter", () => {
    test("should allow a straight (line) edge", () => {
        expect(straightEdgeFilter.allow(lineEdgeShape(XYZ.unitX) as any, undefined as any)).toBe(true);
    });

    test("should reject a circular edge", () => {
        expect(straightEdgeFilter.allow(circleEdgeShape(XYZ.zero, 5) as any, undefined as any)).toBe(false);
    });
});

describe("lineNodeEditHandler", () => {
    test("should return undefined when the points don't match the line's endpoints", () => {
        const { doc } = wireCommand({});
        const line = new LineNode({
            document: doc,
            start: XYZ.zero,
            end: new XYZ({ x: 10, y: 0, z: 0 }),
        });
        const annotation = makeAnnotation(doc);

        const handler = lineNodeEditHandler(
            annotation,
            line,
            new XYZ({ x: 1, y: 1, z: 0 }),
            new XYZ({ x: 2, y: 2, z: 0 }),
        );

        expect(handler).toBeUndefined();
    });

    test("should move the far endpoint and sync the annotation when editing forward", () => {
        const { doc } = wireCommand({});
        const start = XYZ.zero;
        const end = new XYZ({ x: 10, y: 0, z: 0 });
        const line = new LineNode({ document: doc, start, end });
        const annotation = makeAnnotation(doc);

        const handler = lineNodeEditHandler(annotation, line, start, end);
        expect(handler).toBeDefined();

        expect(handler!(20)).toBe(true);
        expect(line.end.isEqualTo(new XYZ({ x: 20, y: 0, z: 0 }), 1e-6)).toBe(true);
        expect(annotation.endPoint.isEqualTo(new XYZ({ x: 20, y: 0, z: 0 }), 1e-6)).toBe(true);
    });

    test("should reject a non-positive length", () => {
        const { doc } = wireCommand({});
        const start = XYZ.zero;
        const end = new XYZ({ x: 10, y: 0, z: 0 });
        const line = new LineNode({ document: doc, start, end });
        const annotation = makeAnnotation(doc);

        const handler = lineNodeEditHandler(annotation, line, start, end)!;
        expect(handler(0)).toBe(false);
        expect(line.end).toEqual(end);
    });
});

describe("rectNodeEditHandler", () => {
    function makeRect(dx: number, dy: number) {
        const { doc } = wireCommand({});
        const rect = new RectNode({ document: doc, plane: PLANE_XY, dx, dy });
        const corners = RectNode.points(PLANE_XY, dx, dy);
        return { rect, corners, doc };
    }

    test("should return undefined for two non-adjacent (diagonal) corners", () => {
        const { rect, corners, doc } = makeRect(10, 6);
        const annotation = makeAnnotation(doc);

        const handler = rectNodeEditHandler(annotation, rect, corners[0], corners[2]);
        expect(handler).toBeUndefined();
    });

    test("should edit dx via the p0-p1 edge and keep p0 anchored", () => {
        const { rect, corners, doc } = makeRect(10, 6);
        const annotation = makeAnnotation(doc, corners[0], corners[1]);

        const handler = rectNodeEditHandler(annotation, rect, corners[0], corners[1]);
        expect(handler).toBeDefined();

        expect(handler!(25)).toBe(true);
        expect(rect.dx).toBe(25);
        expect(rect.dy).toBe(6);
        expect(annotation.startPoint).toEqual(corners[0]);
    });

    test("should edit dy via the p1-p2 edge and keep p1 anchored", () => {
        const { rect, corners, doc } = makeRect(10, 6);
        const annotation = makeAnnotation(doc, corners[1], corners[2]);

        const handler = rectNodeEditHandler(annotation, rect, corners[1], corners[2]);
        expect(handler).toBeDefined();

        expect(handler!(9)).toBe(true);
        expect(rect.dy).toBe(9);
        expect(rect.dx).toBe(10);
        expect(annotation.startPoint).toEqual(corners[1]);
    });

    test("should edit dx via the p3-p2 edge (reverse pick order) and keep p3 anchored", () => {
        const { rect, corners, doc } = makeRect(10, 6);
        const annotation = makeAnnotation(doc, corners[2], corners[3]);

        const handler = rectNodeEditHandler(annotation, rect, corners[2], corners[3]);
        expect(handler).toBeDefined();

        expect(handler!(4)).toBe(true);
        expect(rect.dx).toBe(4);
        expect(annotation.endPoint).toEqual(corners[3]);
    });

    test("should edit dy via the p3-p0 edge and keep p0 anchored", () => {
        const { rect, corners, doc } = makeRect(10, 6);
        const annotation = makeAnnotation(doc, corners[3], corners[0]);

        const handler = rectNodeEditHandler(annotation, rect, corners[3], corners[0]);
        expect(handler).toBeDefined();

        expect(handler!(2)).toBe(true);
        expect(rect.dy).toBe(2);
        expect(annotation.endPoint).toEqual(corners[0]);
    });

    test("should reject a non-positive edited value without touching the rect", () => {
        const { rect, corners, doc } = makeRect(10, 6);
        const annotation = makeAnnotation(doc);

        const handler = rectNodeEditHandler(annotation, rect, corners[0], corners[1])!;
        expect(handler(0)).toBe(false);
        expect(rect.dx).toBe(10);
    });
});
