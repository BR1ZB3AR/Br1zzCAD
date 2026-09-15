// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    HorizontalConstraint,
    Plane,
    prepareSketchSolve,
    Result,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
    solveSketch,
    Transaction,
    XYZ,
} from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import { LineNode } from "../../../src/bodys/line";
import { RectNode } from "../../../src/bodys/rect";
import { createMockShape, setupShapeFactoryMock } from "../../bodys/_utils";

function setup() {
    setupShapeFactoryMock({
        line: () => Result.ok(createMockShape()),
        polygon: () => Result.ok(createMockShape()),
    });
    const doc = new TestDocument();
    const sketch = new SketchGroupNode({ document: doc, name: "Sketch", plane: Plane.XY });
    doc.modelManager.rootNode.add(sketch);
    const line1 = new LineNode({ document: doc, start: XYZ.zero, end: new XYZ({ x: 10, y: 0, z: 0 }) });
    const line2 = new LineNode({ document: doc, start: line1.end, end: new XYZ({ x: 20, y: 10, z: 0 }) });
    sketch.add(line1, line2);
    const handle = (node: { id: string }, role: string) => new SketchPointHandle({ nodeId: node.id, role });
    return { doc, sketch, line1, line2, handle };
}

describe("persistent sketch parameter editing", () => {
    test("an endpoint edit drives a connected endpoint and undoes as one action", () => {
        const { doc, sketch, line1, line2, handle } = setup();
        sketch.add(
            new SketchConstraintNode({
                document: doc,
                constraint: new CoincidentConstraint({
                    p1: handle(line1, "end"),
                    p2: handle(line2, "start"),
                }),
            }),
        );
        const oldPoint = line1.end;
        const count = doc.history.undoCount();
        const target = new XYZ({ x: 12, y: 7, z: 0 });
        line1.end = target;
        expect(line1.end).toEqual(target);
        expect(line2.start.distanceTo(target)).toBeLessThan(1e-7);
        expect(doc.history.undoCount()).toBe(count + 1);
        doc.history.undo();
        expect(line1.end).toEqual(oldPoint);
        expect(line2.start.distanceTo(oldPoint)).toBeLessThan(1e-7);
        doc.history.redo();
        expect(line1.end).toEqual(target);
        expect(line2.start.distanceTo(target)).toBeLessThan(1e-7);
    });

    test("rejects a conflicting parameter without changing geometry or undo history", () => {
        const { doc, sketch, line1, handle } = setup();
        sketch.add(
            new SketchConstraintNode({
                document: doc,
                constraint: new HorizontalConstraint({
                    p1: handle(line1, "start"),
                    p2: handle(line1, "end"),
                }),
            }),
        );
        const before = line1.end;
        const count = doc.history.undoCount();
        line1.end = new XYZ({ x: 10, y: 8, z: 0 });
        expect(line1.end).toEqual(before);
        expect(doc.history.undoCount()).toBe(count);
    });

    test("joins an existing property-edit transaction", () => {
        const { doc, sketch, line1, line2, handle } = setup();
        sketch.add(
            new SketchConstraintNode({
                document: doc,
                constraint: new CoincidentConstraint({
                    p1: handle(line1, "end"),
                    p2: handle(line2, "start"),
                }),
            }),
        );
        const before = line1.end;
        const count = doc.history.undoCount();
        Transaction.execute(doc, "edit", () => {
            line1.end = new XYZ({ x: 30, y: 0, z: 0 });
        });
        expect(doc.history.undoCount()).toBe(count + 1);
        expect(line2.start.x).toBeCloseTo(30);
        doc.history.undo();
        expect(line1.end).toEqual(before);
        expect(line2.start).toEqual(before);
    });

    test.each([
        true,
        false,
    ])("rectangle solving respects its coupled corners (compatible=%s)", (compatible) => {
        const { doc, sketch, line1, handle } = setup();
        line1.start = new XYZ({ x: 20, y: 30, z: 0 });
        line1.end = new XYZ({ x: 50, y: compatible ? 30 : 40, z: 0 });
        const rect = new RectNode({ document: doc, plane: Plane.XY, dx: 10, dy: 15 });
        sketch.add(rect);
        for (const [lineRole, rectRole] of [
            ["start", "corner0"],
            ["end", "corner1"],
        ]) {
            sketch.add(
                new SketchConstraintNode({
                    document: doc,
                    constraint: new CoincidentConstraint({
                        p1: handle(line1, lineRole),
                        p2: handle(rect, rectRole),
                    }),
                }),
            );
        }
        const prepared = prepareSketchSolve(sketch, new Set([line1.id]));
        expect(rect.plane.origin).toEqual(XYZ.zero);
        expect(rect.dx).toBe(10);
        if (compatible) {
            expect(prepared.status).toBe("converged");
            expect(prepared.apply).toBeTypeOf("function");
            prepared.apply!();
            expect(rect.getSketchPoint("corner0")!.distanceTo(line1.start)).toBeLessThan(1e-7);
            expect(rect.getSketchPoint("corner1")!.distanceTo(line1.end)).toBeLessThan(1e-7);
            expect(rect.dy).toBeCloseTo(15);
            expect(solveSketch(sketch).finalResidualNorm).toBeLessThan(1e-7);
        } else {
            expect(prepared.status).not.toBe("converged");
            expect(prepared.apply).toBeUndefined();
            expect(rect.dx).toBe(10);
            expect(rect.plane.origin).toEqual(XYZ.zero);
        }
    });
});
