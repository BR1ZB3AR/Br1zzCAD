// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { CoincidentConstraint, FolderNode, PubSub, SketchPointHandle } from "@chili3d/core";
import { createMockDocument } from "@chili3d/core/test-utils";
import { describe, expect, test } from "@rstest/core";
import {
    applyConstraint,
    findOwningSketch,
    resolveSketchPointHandle,
    resolveSketchPointHandles,
} from "../../../src/commands/constraint/constraintUtils";
import { buildTwoLineSketch, vertexPick } from "./_utils";

describe("resolveSketchPointHandle", () => {
    test("resolves a pick to the nearest role, not just the first one", () => {
        const { line1 } = buildTwoLineSketch();
        // Picked position is closer to `end` than `start`.
        const handle = resolveSketchPointHandle(vertexPick(line1, line1.end));

        expect(handle?.nodeId).toBe(line1.id);
        expect(handle?.role).toBe("end");
    });

    test("returns undefined for a node that isn't an ISketchPointOwner", () => {
        const doc = createMockDocument();
        const folder = new FolderNode({ document: doc, name: "not-a-point-owner" });
        const handle = resolveSketchPointHandle(vertexPick(folder, line1DummyPoint()));

        expect(handle).toBeUndefined();
    });
});

function line1DummyPoint() {
    return { x: 0, y: 0, z: 0 } as any;
}

describe("resolveSketchPointHandles", () => {
    test("drops unresolvable picks and keeps the resolvable ones", () => {
        const { line1 } = buildTwoLineSketch();
        const doc = createMockDocument();
        const folder = new FolderNode({ document: doc, name: "not-a-point-owner" });

        const handles = resolveSketchPointHandles({
            shapes: [vertexPick(line1, line1.start), vertexPick(folder, line1DummyPoint())],
        } as any);

        expect(handles).toHaveLength(1);
        expect(handles[0].role).toBe("start");
    });
});

describe("findOwningSketch", () => {
    test("walks up from a leaf node to its SketchGroupNode", () => {
        const { sketch, line1 } = buildTwoLineSketch();
        expect(findOwningSketch(line1)).toBe(sketch);
    });

    test("returns undefined when there's no SketchGroupNode ancestor", () => {
        const doc = createMockDocument();
        const orphan = new FolderNode({ document: doc, name: "orphan" });
        expect(findOwningSketch(orphan)).toBeUndefined();
    });
});

describe("applyConstraint", () => {
    test("returns true and keeps the constraint when the solve converges", () => {
        const { doc, sketch, line1, line2 } = buildTwoLineSketch();
        const constraint = new CoincidentConstraint({
            p1: resolveSketchPointHandle(vertexPick(line1, line1.end))!,
            p2: resolveSketchPointHandle(vertexPick(line2, line2.start))!,
        });

        const succeeded = applyConstraint(doc, sketch, constraint);

        expect(succeeded).toBe(true);
        expect(sketch.constraints).toContain(constraint);
    });

    test("rolls back and toasts when the constraint can't be satisfied", () => {
        // Two Coincident constraints tying the same pair of points to two
        // different OTHER points that are themselves never made equal is
        // still satisfiable (everything just collapses together) - to force
        // a genuine conflict we instead reuse a runner-level failure mode:
        // referencing a point handle that doesn't exist. applyConstraint
        // should treat that exactly like an unsolvable geometry conflict.
        const { doc, sketch, line1 } = buildTwoLineSketch();
        const constraint = new CoincidentConstraint({
            p1: resolveSketchPointHandle(vertexPick(line1, line1.start))!,
            p2: new SketchPointHandle({ nodeId: "does-not-exist", role: "p" }),
        });

        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const succeeded = applyConstraint(doc, sketch, constraint);

            expect(succeeded).toBe(false);
            expect(sketch.constraints).not.toContain(constraint);
            expect(toastMessage).toBe("toast.constraint.unsolvable");
        } finally {
            PubSub.default.pub = originalPub;
        }
    });
});
