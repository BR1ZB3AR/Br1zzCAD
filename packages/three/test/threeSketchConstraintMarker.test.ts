// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    FolderNode,
    HorizontalConstraint,
    type ISketchPointOwner,
    Matrix4,
    Plane,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
    XYZ,
} from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import { rs } from "@rstest/core";
import { ThreeSketchConstraintMarker } from "../src/threeSketchConstraintMarker";
import { createThreeMockVisualContext } from "./mocks";

/** A minimal `ISketchPointOwner` leaf node, matching the equivalent mock in
 * `packages/core/test/sketchSolverRunner.test.ts` - deliberately not a real
 * `LineNode` (app layer), to keep this a pure `three` test. */
class MockPointOwnerNode extends FolderNode implements ISketchPointOwner {
    private readonly points = new Map<string, XYZ>();

    setPoint(role: string, point: XYZ) {
        this.points.set(role, point);
        // Real ISketchPointOwner nodes (LineNode, ...) change their point
        // through a real @property setter, which emits this automatically -
        // this mock does it by hand (reusing the always-present `name`
        // property as the changed one; the value is unused by listeners
        // here) so ThreeSketchConstraintMarker's subscription can be
        // exercised the same way a real edit would.
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

function contextWithVisual() {
    const context = createThreeMockVisualContext();
    (context as any).visual = {
        document: { selection: { setSelectedNodes: rs.fn() } },
        update: rs.fn(),
    };
    return context;
}

function buildScene() {
    const doc = new TestDocument();
    const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
    const owner = new MockPointOwnerNode({ document: doc, name: "line" });
    owner.setPoint("start", new XYZ({ x: 1, y: 2, z: 0 }));
    owner.setPoint("end", new XYZ({ x: 5, y: 6, z: 0 }));
    sketch.add(owner);

    const constraint = new CoincidentConstraint({
        p1: new SketchPointHandle({ nodeId: owner.id, role: "start" }),
        p2: new SketchPointHandle({ nodeId: owner.id, role: "end" }),
    });
    const constraintNode = new SketchConstraintNode({ document: doc, constraint });
    sketch.add(constraintNode);

    return { doc, sketch, owner, constraintNode };
}

describe("ThreeSketchConstraintMarker", () => {
    test("locked and transform default like other annotation visuals", () => {
        const { constraintNode } = buildScene();
        const marker = new ThreeSketchConstraintMarker(contextWithVisual(), constraintNode);

        expect(marker.locked).toBe(false);
        expect(marker.transform.equals(Matrix4.identity())).toBe(true);
        expect(marker.worldTransform().equals(Matrix4.identity())).toBe(true);
        expect(marker.boundingBox()).toBeUndefined();
    });

    test("positions itself at the first handle's resolved point", () => {
        const { constraintNode } = buildScene();
        const marker = new ThreeSketchConstraintMarker(contextWithVisual(), constraintNode);

        const label = marker.children[0] as unknown as { position: { x: number; y: number; z: number } };
        expect(label.position.x).toBeCloseTo(1);
        expect(label.position.y).toBeCloseTo(2);
    });

    test("refreshes its position when the owning point's node changes", () => {
        const { constraintNode, owner } = buildScene();
        const marker = new ThreeSketchConstraintMarker(contextWithVisual(), constraintNode);

        owner.setPoint("start", new XYZ({ x: 99, y: 42, z: 0 }));

        const label = marker.children[0] as unknown as { position: { x: number; y: number; z: number } };
        expect(label.position.x).toBeCloseTo(99);
        expect(label.position.y).toBeCloseTo(42);
    });

    test("clicking the badge selects the constraint node", () => {
        const { constraintNode } = buildScene();
        const context = contextWithVisual();
        const marker = new ThreeSketchConstraintMarker(context, constraintNode);

        const label = marker.children[0] as unknown as { element: HTMLElement };
        label.element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

        expect((context.visual.document.selection.setSelectedNodes as any).mock.calls[0][0]).toEqual([
            constraintNode,
        ]);
        expect(context.visual.update).toHaveBeenCalled();
    });

    test("shows a distinct badge per constraint kind", () => {
        const { doc, sketch, owner } = buildScene();
        const horizontal = new SketchConstraintNode({
            document: doc,
            constraint: new HorizontalConstraint({
                p1: new SketchPointHandle({ nodeId: owner.id, role: "start" }),
                p2: new SketchPointHandle({ nodeId: owner.id, role: "end" }),
            }),
        });
        sketch.add(horizontal);
        const marker = new ThreeSketchConstraintMarker(contextWithVisual(), horizontal);
        const label = marker.children[0] as unknown as { element: HTMLElement };
        expect(label.element.textContent).toBe("H");
    });

    test("highlight/unhighlight toggle the badge's outline", () => {
        const { constraintNode } = buildScene();
        const marker = new ThreeSketchConstraintMarker(contextWithVisual(), constraintNode);
        const label = marker.children[0] as unknown as { element: HTMLElement };

        marker.highlight();
        expect(label.element.style.outline).toContain("00ffff");

        marker.unhighlight();
        expect(label.element.style.outline).not.toContain("00ffff");
    });

    test("dispose stops listening for owner changes", () => {
        const { constraintNode, owner } = buildScene();
        const marker = new ThreeSketchConstraintMarker(contextWithVisual(), constraintNode);
        const label = marker.children[0] as unknown as { position: { x: number; y: number; z: number } };

        marker.dispose();
        owner.setPoint("start", new XYZ({ x: 500, y: 500, z: 0 }));

        // Position stays wherever it last was (1, 2) - the change never reaches it.
        expect(label.position.x).toBeCloseTo(1);
    });

    test("does nothing (no crash) when it isn't parented under a SketchGroupNode yet", () => {
        const doc = new TestDocument();
        const constraint = new CoincidentConstraint({
            p1: new SketchPointHandle({ nodeId: "a", role: "start" }),
            p2: new SketchPointHandle({ nodeId: "b", role: "start" }),
        });
        const orphanNode = new SketchConstraintNode({ document: doc, constraint });

        expect(() => new ThreeSketchConstraintMarker(contextWithVisual(), orphanNode)).not.toThrow();
    });
});
