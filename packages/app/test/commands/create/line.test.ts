// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Result, ShapeTypes, XYZ } from "@chili3d/core";
import { createMockEdgeCurve } from "@chili3d/core/test-utils";
import { afterAll, beforeAll, describe, expect, test } from "@rstest/core";
import { LineNode } from "../../../src/bodys";
import { FaceNode } from "../../../src/bodys/face";
import { Line } from "../../../src/commands/create/line";
import { ensureGlobalStubApp, pointStepResult, seedStepDatas, wireCommand } from "../commandTestUtils";

/**
 * ensureGlobalStubApp() (used file-wide below) installs `globalThis.app` as a
 * Proxy whose `get` trap returns a canned success for every property access,
 * ignoring whatever the target actually holds - so a naive merge-based
 * shapeFactory mock has no visible effect here. Redefine `globalThis.app`
 * directly with a plain (non-proxy) factory for the scope of a single test.
 */
function stubShapeFactory(methods: Record<string, (...args: any[]) => any>): () => void {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "app");
    const stubApp = { shapeProvider: { factory: methods, converter: {} } } as any;
    Object.defineProperty(globalThis, "app", {
        configurable: true,
        get: () => stubApp,
    });
    return () => {
        if (previous) Object.defineProperty(globalThis, "app", previous);
    };
}

/** A mock edge shape whose curve interpolates linearly between start/end,
 * matching what FaceNode's endpoint-based grouping reads. */
function mockLineEdge(start: XYZ, end: XYZ) {
    const shape: any = {
        shapeType: ShapeTypes.edge,
        curve: createMockEdgeCurve({
            start,
            end,
            valueFn: (t: number) =>
                new XYZ({
                    x: start.x + (end.x - start.x) * t,
                    y: start.y + (end.y - start.y) * t,
                    z: start.z + (end.z - start.z) * t,
                }),
        }),
        isEqual: () => false,
        dispose: () => {},
    };
    shape.clone = () => shape;
    return shape;
}

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("Line", () => {
    test("should have command metadata", () => {
        const data = (Line as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.line");
        expect(data.icon).toBe("icon-line");
    });

    test("isContinue should default to true", () => {
        const cmd = new Line();
        expect(cmd.isContinue).toBe(true);
    });

    test("isContinue setter should update property", () => {
        const cmd = new Line();
        cmd.isContinue = false;
        expect(cmd.isContinue).toBe(false);
    });

    test("getSteps should return two steps", () => {
        const cmd = new Line();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    function lineWithPoints(start: XYZ, end: XYZ): Line {
        const cmd = new Line();
        wireCommand(cmd);
        seedStepDatas(cmd, [pointStepResult({ point: start }), pointStepResult({ point: end })]);
        return cmd;
    }

    describe("geometryNode", () => {
        test("should build a LineNode from two points", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 5, z: 3 }));
            const node = (cmd as any).geometryNode();
            expect(node).toBeInstanceOf(LineNode);
            expect(node.start.isEqualTo(new XYZ({ x: 0, y: 0, z: 0 }))).toBe(true);
            expect(node.end.isEqualTo(new XYZ({ x: 10, y: 5, z: 3 }))).toBe(true);
        });
    });

    describe("getSecondPointData", () => {
        test("should expose refPoint, dimension, validator, and preview", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const data = (cmd as any).getSecondPointData();
            expect(typeof data.refPoint).toBe("function");
            expect(typeof data.validator).toBe("function");
            expect(typeof data.preview).toBe("function");
        });

        test("refPoint should return the first step's point", () => {
            const cmd = lineWithPoints(new XYZ({ x: 2, y: 3, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const data = (cmd as any).getSecondPointData();
            expect(data.refPoint().isEqualTo(new XYZ({ x: 2, y: 3, z: 0 }))).toBe(true);
        });

        test("validator should reject a coincident point", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const data = (cmd as any).getSecondPointData();
            expect(data.validator(new XYZ({ x: 0, y: 0, z: 0 }))).toBe(false);
        });

        test("validator should accept a distinct point", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const data = (cmd as any).getSecondPointData();
            expect(data.validator(new XYZ({ x: 5, y: 0, z: 0 }))).toBe(true);
        });
    });

    describe("linePreview", () => {
        test("should render only the first point when new point is undefined", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const preview = (cmd as any).linePreview(undefined);
            expect(preview).toHaveLength(1);
        });

        test("should render first point and a line when new point is given", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            const preview = (cmd as any).linePreview(new XYZ({ x: 5, y: 0, z: 0 }));
            expect(preview).toHaveLength(2);
        });
    });

    describe("resetStepDatas", () => {
        test("should keep first step when isContinue is true", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            cmd.isContinue = true;
            (cmd as any).resetStepDatas();
            expect((cmd as any).stepDatas).toHaveLength(1);
            // step 0 should now be the previous end point
            expect((cmd as any).stepDatas[0].point!.isEqualTo(new XYZ({ x: 10, y: 0, z: 0 }))).toBe(true);
        });

        test("should clear all step data when isContinue is false", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            cmd.isContinue = false;
            (cmd as any).resetStepDatas();
            expect((cmd as any).stepDatas).toHaveLength(0);
        });
    });

    describe("executeMainTask", () => {
        test("should set repeatOperation to true via super call", () => {
            const cmd = lineWithPoints(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 10, y: 0, z: 0 }));
            // Call the actual method - it delegates to super.executeMainTask and sets repeatOperation
            (cmd as any).executeMainTask();
            expect((cmd as any).repeatOperation).toBe(true);
        });
    });

    // Sketching 4 separate connected segments that close back on the start
    // point (the "Connected" / isContinue workflow) should auto-convert into
    // a single face instead of leaving 4 disjoint open edges nobody can
    // easily select as a whole.
    describe("chain auto-close into face", () => {
        function drawSegment(cmd: Line, start: XYZ, end: XYZ) {
            seedStepDatas(cmd, [pointStepResult({ point: start }), pointStepResult({ point: end })]);
            (cmd as any).executeMainTask();
        }

        const p1 = new XYZ({ x: 0, y: 0, z: 0 });
        const p2 = new XYZ({ x: 10, y: 0, z: 0 });
        const p3 = new XYZ({ x: 10, y: 10, z: 0 });
        const p4 = new XYZ({ x: 0, y: 10, z: 0 });

        test("closing a 4-segment loop removes the lines and adds one FaceNode", () => {
            const restore = stubShapeFactory({
                line: (start: XYZ, end: XYZ) => Result.ok(mockLineEdge(start, end)),
                wire: () => Result.ok(mockLineEdge(XYZ.zero, XYZ.zero)),
                face: () => Result.ok(mockLineEdge(XYZ.zero, XYZ.zero)),
            });
            try {
                const cmd = new Line();
                const { addedNodes } = wireCommand(cmd);

                drawSegment(cmd, p1, p2);
                drawSegment(cmd, p2, p3);
                drawSegment(cmd, p3, p4);
                drawSegment(cmd, p4, p1); // closes the loop

                expect(addedNodes.filter((n) => n instanceof LineNode)).toHaveLength(4);
                const faceNodes = addedNodes.filter((n) => n instanceof FaceNode);
                expect(faceNodes).toHaveLength(1);
                expect((faceNodes[0] as FaceNode).shapes).toHaveLength(4);
            } finally {
                restore();
            }
        });

        test("a chain that never closes stays as separate open lines - no face added", () => {
            const restore = stubShapeFactory({
                line: (start: XYZ, end: XYZ) => Result.ok(mockLineEdge(start, end)),
            });
            try {
                const cmd = new Line();
                const { addedNodes } = wireCommand(cmd);

                drawSegment(cmd, p1, p2);
                drawSegment(cmd, p2, p3);
                drawSegment(cmd, p3, p4); // never comes back to p1

                expect(addedNodes.filter((n) => n instanceof LineNode)).toHaveLength(3);
                expect(addedNodes.filter((n) => n instanceof FaceNode)).toHaveLength(0);
            } finally {
                restore();
            }
        });

        test("disabling isContinue mid-chain resets tracking so a later coincidental close doesn't fire", () => {
            const restore = stubShapeFactory({
                line: (start: XYZ, end: XYZ) => Result.ok(mockLineEdge(start, end)),
            });
            try {
                const cmd = new Line();
                const { addedNodes } = wireCommand(cmd);

                drawSegment(cmd, p1, p2);
                cmd.isContinue = false;
                drawSegment(cmd, p2, p3); // isContinue is false for this segment
                cmd.isContinue = true;
                drawSegment(cmd, p3, p1); // would close the original p1-p2-p3 triangle, but tracking was reset

                expect(addedNodes.filter((n) => n instanceof LineNode)).toHaveLength(3);
                expect(addedNodes.filter((n) => n instanceof FaceNode)).toHaveLength(0);
            } finally {
                restore();
            }
        });

        test("a non-planar loop fails to build a face and leaves the lines in place", () => {
            const restore = stubShapeFactory({
                line: (start: XYZ, end: XYZ) => Result.ok(mockLineEdge(start, end)),
                wire: () => Result.err("cannot create wire"),
            });
            try {
                const cmd = new Line();
                const { addedNodes } = wireCommand(cmd);

                drawSegment(cmd, p1, p2);
                drawSegment(cmd, p2, p3);
                drawSegment(cmd, p3, p1); // closes a 3-segment loop, but face-building fails

                expect(addedNodes.filter((n) => n instanceof LineNode)).toHaveLength(3);
                expect(addedNodes.filter((n) => n instanceof FaceNode)).toHaveLength(0);
            } finally {
                restore();
            }
        });
    });
});
