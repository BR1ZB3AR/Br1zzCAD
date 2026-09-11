// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    FolderNode,
    type IDocument,
    Plane,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
} from "../../src";
import { TestDocument } from "../../test-utils";

describe("SketchGroupNode", () => {
    const doc: IDocument = new TestDocument() as any;

    test("should set name, document and plane via constructor", () => {
        const node = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        expect(node.name).toBe("Sketch 1");
        expect(node.document).toBe(doc);
        expect(node.plane).toBe(Plane.XY);
    });

    test("should be a GroupNode with an independent working plane", () => {
        const xy = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const zx = new SketchGroupNode({ document: doc, name: "Sketch 2", plane: Plane.ZX });
        expect(xy.plane).toBe(Plane.XY);
        expect(zx.plane).toBe(Plane.ZX);
        expect(xy.transform.equals(zx.transform)).toBe(true);
    });

    describe("constraints", () => {
        function makeConstraintNode() {
            return new SketchConstraintNode({
                document: doc,
                constraint: new CoincidentConstraint({
                    p1: new SketchPointHandle({ nodeId: "a", role: "start" }),
                    p2: new SketchPointHandle({ nodeId: "b", role: "start" }),
                }),
            });
        }

        test("is empty for a sketch with no constraint children", () => {
            const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
            expect(sketch.constraints).toEqual([]);
        });

        test("reflects a SketchConstraintNode added as a child", () => {
            const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
            const constraintNode = makeConstraintNode();
            sketch.add(constraintNode);

            expect(sketch.constraints).toEqual([constraintNode.constraint]);
        });

        test("no longer reflects a constraint once its node is removed", () => {
            const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
            const constraintNode = makeConstraintNode();
            sketch.add(constraintNode);
            expect(sketch.constraints).toHaveLength(1);

            sketch.remove(constraintNode);

            expect(sketch.constraints).toEqual([]);
        });

        test("ignores non-constraint children", () => {
            const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
            sketch.add(new FolderNode({ document: doc, name: "not-a-constraint" }));

            expect(sketch.constraints).toEqual([]);
        });

        test("has no setter - constraints are only added/removed as tree children", () => {
            const descriptor = Object.getOwnPropertyDescriptor(SketchGroupNode.prototype, "constraints");
            expect(descriptor?.set).toBeUndefined();
            expect(descriptor?.get).toBeDefined();
        });
    });
});
