// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    FolderNode,
    type ISketchPointOwner,
    Plane,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
    XYZ,
} from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import { rs } from "@rstest/core";
import { ThreeSketchDofCoordinator } from "../src/threeSketchDofCoordinator";

/** Mirrors `threeSketchConstraintMarker.test.ts`'s own mock - real changes
 * go through `emitPropertyChanged` (protected on a subclass), the same way
 * a real `ISketchPointOwner` (LineNode, ...) would. */
class MockPointOwnerNode extends FolderNode implements ISketchPointOwner {
    private readonly points = new Map<string, XYZ>();

    setPoint(role: string, point: XYZ) {
        this.points.set(role, point);
        this.emitPropertyChanged("name", this.name);
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

/** A stand-in for `ThreeVisualContext` exposing only what the coordinator
 * actually uses - `getVisual` is a spy returning `undefined` (not a real
 * `ThreeGeometry`), so `paintAll` exercises its lookup/dispatch without
 * needing a full mesh/material setup; the visible-coloring result itself
 * is verified live (Playwright), not through this mock. */
function buildContext(doc: TestDocument) {
    return {
        getVisual: rs.fn(),
        visual: { document: doc, update: rs.fn() },
    };
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("ThreeSketchDofCoordinator", () => {
    test("recomputes once on construction and paints every point owner", async () => {
        const doc = new TestDocument();
        const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const node = new MockPointOwnerNode({ document: doc, name: "line" });
        node.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        sketch.add(node);
        const context = buildContext(doc);

        const coordinator = new ThreeSketchDofCoordinator(context as any, sketch);
        await flushMicrotasks();

        expect(context.getVisual).toHaveBeenCalledWith(node);
        expect(context.visual.update).toHaveBeenCalled();
        coordinator.dispose();
    });

    test("a tracked node's property change triggers exactly one coalesced recompute", async () => {
        const doc = new TestDocument();
        const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const node = new MockPointOwnerNode({ document: doc, name: "line" });
        node.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        sketch.add(node);
        const context = buildContext(doc);

        const coordinator = new ThreeSketchDofCoordinator(context as any, sketch);
        await flushMicrotasks();
        (context.visual.update as any).mockClear();
        (context.getVisual as any).mockClear();

        // Two changes in the same tick - should still only repaint once.
        node.setPoint("p", new XYZ({ x: 1, y: 1, z: 0 }));
        node.setPoint("p", new XYZ({ x: 2, y: 2, z: 0 }));
        await flushMicrotasks();

        expect(context.visual.update).toHaveBeenCalledTimes(1);
        coordinator.dispose();
    });

    test("picks up a node added to the sketch after construction", async () => {
        const doc = new TestDocument();
        const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const context = buildContext(doc);
        const coordinator = new ThreeSketchDofCoordinator(context as any, sketch);
        await flushMicrotasks();

        const node = new MockPointOwnerNode({ document: doc, name: "line" });
        node.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        sketch.add(node);
        await flushMicrotasks();

        expect(context.getVisual).toHaveBeenCalledWith(node);
        coordinator.dispose();
    });

    test("dispose stops listening and repaints back to normal", async () => {
        const doc = new TestDocument();
        const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
        nodeA.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
        nodeB.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        sketch.add(nodeA, nodeB);
        sketch.add(
            new SketchConstraintNode({
                document: doc,
                constraint: new CoincidentConstraint({
                    p1: new SketchPointHandle({ nodeId: nodeA.id, role: "p" }),
                    p2: new SketchPointHandle({ nodeId: nodeB.id, role: "p" }),
                }),
            }),
        );
        const context = buildContext(doc);
        const coordinator = new ThreeSketchDofCoordinator(context as any, sketch);
        await flushMicrotasks();
        (context.visual.update as any).mockClear();
        (context.getVisual as any).mockClear();

        coordinator.dispose();
        await flushMicrotasks();

        // The dispose-time repaint must actually revisit every previously
        // tracked entity (not just call update() with an empty pass) - a
        // real bug here once had `listenedNodes` cleared before this loop
        // ran, silently skipping every entity and leaving DOF colors stuck.
        expect(context.getVisual).toHaveBeenCalledWith(nodeA);
        expect(context.getVisual).toHaveBeenCalledWith(nodeB);

        (context.visual.update as any).mockClear();
        // A property change after dispose must not trigger another repaint.
        nodeA.setPoint("p", new XYZ({ x: 5, y: 5, z: 0 }));
        await flushMicrotasks();

        expect(context.visual.update).not.toHaveBeenCalled();
    });
});
