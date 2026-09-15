// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    analyzeSketchDOF,
    CoincidentConstraint,
    EqualConstraint,
    FixedConstraint,
    FolderNode,
    HorizontalConstraint,
    type ISketchPointOwner,
    PerpendicularConstraint,
    Plane,
    type SketchConstraint,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
    VerticalConstraint,
    XYZ,
} from "../src";
import { TestDocument } from "../test-utils";

/** Mirrors `sketchSolverRunner.test.ts`'s own mock - a minimal
 * `ISketchPointOwner` leaf, deliberately not a real `LineNode` (which
 * lives in `packages/app`), keeping this a pure `core` test. */
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

/** A toy axis-aligned-rectangle owner exercising the parameterized quartet
 * (`getSketchParameters`/`getParameterizedSketchPoint`/`setSketchParameters`)
 * - its own [originU, originV, dx, dy], not 8 independent corner
 * coordinates, matching how `RectNode` (`packages/app`) is really solved. */
class MockRectOwnerNode extends FolderNode implements ISketchPointOwner {
    private u = 0;
    private v = 0;
    private dx = 10;
    private dy = 10;

    private corner(role: string, u: number, v: number, dx: number, dy: number): XYZ | undefined {
        switch (role) {
            case "corner0":
                return new XYZ({ x: u, y: v, z: 0 });
            case "corner1":
                return new XYZ({ x: u + dx, y: v, z: 0 });
            case "corner2":
                return new XYZ({ x: u + dx, y: v + dy, z: 0 });
            case "corner3":
                return new XYZ({ x: u, y: v + dy, z: 0 });
            default:
                return undefined;
        }
    }

    sketchPointRoles(): readonly string[] {
        return ["corner0", "corner1", "corner2", "corner3"];
    }

    getSketchPoint(role: string): XYZ | undefined {
        return this.corner(role, this.u, this.v, this.dx, this.dy);
    }

    setSketchPoint(): void {
        // Not exercised here - solved through the parameterized quartet instead.
    }

    getSketchParameters(): number[] {
        return [this.u, this.v, this.dx, this.dy];
    }

    getParameterizedSketchPoint(role: string, parameters: readonly number[]): XYZ | undefined {
        const [u, v, dx, dy] = parameters;
        return this.corner(role, u, v, dx, dy);
    }

    setSketchParameters(parameters: readonly number[]): void {
        [this.u, this.v, this.dx, this.dy] = parameters;
    }

    isValidSketchParameters(parameters: readonly number[]): boolean {
        return Math.abs(parameters[2]) > 1e-6 && Math.abs(parameters[3]) > 1e-6;
    }
}

function handle(node: { id: string }, role: string): SketchPointHandle {
    return new SketchPointHandle({ nodeId: node.id, role });
}

function addConstraint(doc: TestDocument, sketch: SketchGroupNode, constraint: SketchConstraint) {
    sketch.add(new SketchConstraintNode({ document: doc, constraint }));
}

describe("analyzeSketchDOF", () => {
    let doc: TestDocument;
    let sketch: SketchGroupNode;

    beforeEach(() => {
        doc = new TestDocument();
        sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
    });

    test("a lone unconstrained entity is under-constrained", () => {
        const node = new MockPointOwnerNode({ document: doc, name: "n" });
        node.setPoint("p", new XYZ({ x: 1, y: 2, z: 0 }));
        sketch.add(node);

        const status = analyzeSketchDOF(sketch);

        expect(status.get(node.id)).toBe("underConstrained");
    });

    test("two points tied Coincident, nothing else, are still under-constrained", () => {
        const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
        nodeA.setPoint("p", new XYZ({ x: 3, y: 4, z: 0 }));
        const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
        nodeB.setPoint("p", new XYZ({ x: 3, y: 4, z: 0 }));
        sketch.add(nodeA, nodeB);
        addConstraint(
            doc,
            sketch,
            new CoincidentConstraint({ p1: handle(nodeA, "p"), p2: handle(nodeB, "p") }),
        );

        const status = analyzeSketchDOF(sketch);

        // Coincidence ties the two points together but pins neither one to
        // an absolute location - the pair can still translate as a unit.
        expect(status.get(nodeA.id)).toBe("underConstrained");
        expect(status.get(nodeB.id)).toBe("underConstrained");
    });

    test("a rect owner's coupled corners are respected, not treated as 8 independent coordinates", () => {
        const rect = new MockRectOwnerNode({ document: doc, name: "rect" });
        sketch.add(rect);
        // Anchor 3 of the 4 corners - corner2 is never referenced by any
        // constraint, but is fully determined by the same 4 parameters the
        // other 3 corners already pin.
        addConstraint(doc, sketch, new FixedConstraint({ p1: handle(rect, "corner0"), u: 0, v: 0 }));
        addConstraint(doc, sketch, new FixedConstraint({ p1: handle(rect, "corner1"), u: 10, v: 0 }));
        addConstraint(doc, sketch, new FixedConstraint({ p1: handle(rect, "corner3"), u: 0, v: 10 }));

        const status = analyzeSketchDOF(sketch);

        expect(status.get(rect.id)).toBe("fullyConstrained");
    });

    test("a fully anchored triangle is fully constrained", () => {
        // A right isosceles triangle: A=(0,0), B=(10,0), C=(5,5) - the
        // right angle sits at C (CA is perpendicular to CB, |CA|=|CB|),
        // already satisfied by construction (no solve needed).
        const lineAB = new MockPointOwnerNode({ document: doc, name: "AB" });
        lineAB.setPoint("start", new XYZ({ x: 0, y: 0, z: 0 }));
        lineAB.setPoint("end", new XYZ({ x: 10, y: 0, z: 0 }));
        const lineBC = new MockPointOwnerNode({ document: doc, name: "BC" });
        lineBC.setPoint("start", new XYZ({ x: 10, y: 0, z: 0 }));
        lineBC.setPoint("end", new XYZ({ x: 5, y: 5, z: 0 }));
        const lineCA = new MockPointOwnerNode({ document: doc, name: "CA" });
        lineCA.setPoint("start", new XYZ({ x: 5, y: 5, z: 0 }));
        lineCA.setPoint("end", new XYZ({ x: 0, y: 0, z: 0 }));
        sketch.add(lineAB, lineBC, lineCA);

        addConstraint(
            doc,
            sketch,
            new CoincidentConstraint({ p1: handle(lineAB, "end"), p2: handle(lineBC, "start") }),
        );
        addConstraint(
            doc,
            sketch,
            new CoincidentConstraint({ p1: handle(lineBC, "end"), p2: handle(lineCA, "start") }),
        );
        addConstraint(
            doc,
            sketch,
            new CoincidentConstraint({ p1: handle(lineCA, "end"), p2: handle(lineAB, "start") }),
        );
        addConstraint(doc, sketch, new FixedConstraint({ p1: handle(lineAB, "start"), u: 0, v: 0 }));
        addConstraint(doc, sketch, new FixedConstraint({ p1: handle(lineAB, "end"), u: 10, v: 0 }));
        addConstraint(
            doc,
            sketch,
            new PerpendicularConstraint({
                a1: handle(lineBC, "start"),
                a2: handle(lineBC, "end"),
                b1: handle(lineCA, "start"),
                b2: handle(lineCA, "end"),
            }),
        );
        addConstraint(
            doc,
            sketch,
            new EqualConstraint({
                a1: handle(lineBC, "start"),
                a2: handle(lineBC, "end"),
                b1: handle(lineCA, "start"),
                b2: handle(lineCA, "end"),
            }),
        );

        const status = analyzeSketchDOF(sketch);

        expect(status.get(lineAB.id)).toBe("fullyConstrained");
        expect(status.get(lineBC.id)).toBe("fullyConstrained");
        expect(status.get(lineCA.id)).toBe("fullyConstrained");
    });

    test("a genuinely conflicting constraint pair reads as conflicting, not under/fully-constrained", () => {
        const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
        nodeA.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
        // A diagonal segment can satisfy neither Horizontal nor Vertical.
        nodeB.setPoint("p", new XYZ({ x: 5, y: 5, z: 0 }));
        sketch.add(nodeA, nodeB);
        addConstraint(
            doc,
            sketch,
            new HorizontalConstraint({ p1: handle(nodeA, "p"), p2: handle(nodeB, "p") }),
        );
        addConstraint(
            doc,
            sketch,
            new VerticalConstraint({ p1: handle(nodeA, "p"), p2: handle(nodeB, "p") }),
        );

        const status = analyzeSketchDOF(sketch);

        expect(status.get(nodeA.id)).toBe("conflicting");
        expect(status.get(nodeB.id)).toBe("conflicting");
    });

    test("an empty sketch returns an empty map", () => {
        expect(analyzeSketchDOF(sketch).size).toBe(0);
    });
});
