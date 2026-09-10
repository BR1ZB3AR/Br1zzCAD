// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    FolderNode,
    type ISketchPointOwner,
    Plane,
    SketchGroupNode,
    SketchPointHandle,
    solveSketch,
    XYZ,
} from "../src";
import { TestDocument } from "../test-utils";

/** A minimal `ISketchPointOwner` leaf node - deliberately not a real
 * `LineNode` (which lives in `packages/app`), to keep this a pure `core`
 * test with no dependency on the app layer, per this module's own layering
 * (core defines interfaces, app implements them). */
class MockPointOwnerNode extends FolderNode implements ISketchPointOwner {
    private readonly points = new Map<string, XYZ>();

    setPoint(role: string, point: XYZ) {
        this.points.set(role, point);
    }

    sketchPointRoles(): readonly string[] {
        return Array.from(this.points.keys());
    }

    getSketchPoint(role: string): XYZ | undefined {
        return this.points.get(role);
    }

    setSketchPoint(role: string, point: XYZ): void {
        this.points.set(role, point);
    }
}

describe("solveSketch", () => {
    let doc: TestDocument;
    let sketch: SketchGroupNode;

    beforeEach(() => {
        doc = new TestDocument();
        sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
    });

    test("with no constraints, converges trivially and touches nothing", () => {
        const node = new MockPointOwnerNode({ document: doc, name: "n" });
        node.setPoint("p", new XYZ({ x: 1, y: 2, z: 0 }));
        sketch.add(node);

        const outcome = solveSketch(sketch);

        expect(outcome.status).toBe("converged");
        expect(outcome.finalResidualNorm).toBe(0);
        expect(node.getSketchPoint("p")).toEqual(new XYZ({ x: 1, y: 2, z: 0 }));
    });

    test("solves a coincident constraint and writes the result back to both nodes", () => {
        const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
        nodeA.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
        nodeB.setPoint("p", new XYZ({ x: 10, y: 10, z: 0 }));
        sketch.add(nodeA, nodeB);

        sketch.addConstraint(
            new CoincidentConstraint({
                p1: new SketchPointHandle({ nodeId: nodeA.id, role: "p" }),
                p2: new SketchPointHandle({ nodeId: nodeB.id, role: "p" }),
            }),
        );

        const outcome = solveSketch(sketch);

        expect(outcome.status).toBe("converged");
        const pointA = nodeA.getSketchPoint("p")!;
        const pointB = nodeB.getSketchPoint("p")!;
        expect(pointA.x).toBeCloseTo(pointB.x, 5);
        expect(pointA.y).toBeCloseTo(pointB.y, 5);
    });

    test("reports missingPoint and leaves geometry untouched when a constraint references a node not in the sketch", () => {
        const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
        const original = new XYZ({ x: 0, y: 0, z: 0 });
        nodeA.setPoint("p", original);
        sketch.add(nodeA);

        sketch.addConstraint(
            new CoincidentConstraint({
                p1: new SketchPointHandle({ nodeId: nodeA.id, role: "p" }),
                p2: new SketchPointHandle({ nodeId: "does-not-exist", role: "p" }),
            }),
        );

        const outcome = solveSketch(sketch);

        expect(outcome.status).toBe("missingPoint");
        expect(nodeA.getSketchPoint("p")).toEqual(original);
    });

    test("reports missingPoint when a constraint references a role the node doesn't have", () => {
        const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
        nodeA.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
        nodeB.setPoint("p", new XYZ({ x: 1, y: 1, z: 0 }));
        sketch.add(nodeA, nodeB);

        sketch.addConstraint(
            new CoincidentConstraint({
                p1: new SketchPointHandle({ nodeId: nodeA.id, role: "p" }),
                p2: new SketchPointHandle({ nodeId: nodeB.id, role: "nonexistentRole" }),
            }),
        );

        const outcome = solveSketch(sketch);

        expect(outcome.status).toBe("missingPoint");
    });
});
