// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDisposable, type INode, Matrix4, Plane, SelectShapeStep, VisualStates } from "@chili3d/core";
import {
    createMockApplication,
    createMockDocument,
    createMockHighlighter,
    createMockView,
} from "@chili3d/core/test-utils";
import { describe, expect, rs, test } from "@rstest/core";
import { PickSketchPlane } from "../../src/commands/sketchPlane";
import { ensureGlobalStubApp } from "./commandTestUtils";

interface Rig {
    doc: ReturnType<typeof createMockDocument>;
    view: ReturnType<typeof createMockView>;
    addedNodes: INode[];
    removedNodes: INode[];
    labelDisposeSpies: ReturnType<typeof rs.fn>[];
    highlightCalls: ReturnType<typeof createMockHighlighter>["addCalls"];
    /** Set this before invoking execute() to control which node the mock picker "clicks". */
    pickIndex: number | undefined;
}

function buildRig(): Rig {
    const addedNodes: INode[] = [];
    const removedNodes: INode[] = [];
    const labelDisposeSpies: ReturnType<typeof rs.fn>[] = [];
    const rig = { pickIndex: undefined } as unknown as Rig;

    const doc = createMockDocument();
    (doc.visual.context as any).addNode = (nodes: INode[]) => addedNodes.push(...nodes);
    (doc.visual.context as any).removeNode = (nodes: INode[]) => removedNodes.push(...nodes);
    // Each temp node gets its own fake "visual object" so getVisual(node) can
    // resolve it - a plain marker object per node is enough for addState's
    // (untyped-in-tests) shape parameter.
    const visualsByNode = new Map<INode, object>();
    (doc.visual.context as any).getVisual = (node: INode) => {
        if (!visualsByNode.has(node)) visualsByNode.set(node, { node });
        return visualsByNode.get(node);
    };
    const { highlighter, addCalls } = createMockHighlighter();
    (doc.visual as any).highlighter = highlighter;
    (doc.selection as any).clearSelection = rs.fn();
    (doc as any).picker = {
        pickShape: async () => {
            if (rig.pickIndex === undefined) return [];
            return [
                {
                    owner: { node: addedNodes[rig.pickIndex] },
                    shape: {} as any,
                    transform: Matrix4.identity(),
                    indexes: [],
                },
            ];
        },
        pickNode: async () => [],
        pickAsync: async () => {},
    };

    const view = createMockView({
        document: doc,
        htmlText: rs.fn((_text: string, _point: unknown, _options?: unknown): IDisposable => {
            const disposeSpy = rs.fn();
            labelDisposeSpies.push(disposeSpy);
            return { dispose: disposeSpy };
        }) as any,
    });
    (view as any).document = doc;

    Object.assign(rig, { doc, view, addedNodes, removedNodes, labelDisposeSpies, highlightCalls: addCalls });
    return rig;
}

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("PickSketchPlane", () => {
    test("should have command metadata", () => {
        const data = (PickSketchPlane as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("sketch.pickPlane");
        expect(data.icon).toBe("icon-setWorkingPlane");
    });

    test("should do nothing when activeView is undefined", async () => {
        const stepExecuteSpy = rs.spyOn(SelectShapeStep.prototype, "execute");

        const app = createMockApplication();
        app.activeView = undefined;

        const cmd = new PickSketchPlane();
        await expect(cmd.execute(app)).resolves.toBeUndefined();

        expect(stepExecuteSpy).not.toHaveBeenCalled();
        stepExecuteSpy.mockRestore();
    });

    test("adds three temporary reference-plane nodes and three floating labels to the viewport", async () => {
        const rig = buildRig();
        const app = createMockApplication();
        app.activeView = rig.view;

        await new PickSketchPlane().execute(app);

        expect(rig.addedNodes).toHaveLength(3);
        expect(rig.view.htmlText).toHaveBeenCalledTimes(3);
        const labels = (rig.view.htmlText as ReturnType<typeof rs.fn>).mock.calls.map((c) => c[0]);
        expect(labels.sort()).toEqual(["FRONT", "RIGHT", "TOP"]);
    });

    test("marks all three reference planes transparent as soon as they're shown", async () => {
        const rig = buildRig();
        const app = createMockApplication();
        app.activeView = rig.view;

        await new PickSketchPlane().execute(app);

        expect(rig.highlightCalls).toHaveLength(3);
        for (const call of rig.highlightCalls) {
            expect(call.state).toBe(VisualStates.faceTransparent);
        }
    });

    test("cleans up the temporary nodes and label overlays whether or not a plane was picked", async () => {
        const rig = buildRig();
        rig.pickIndex = undefined; // simulate ESC / no pick
        const app = createMockApplication();
        app.activeView = rig.view;

        await new PickSketchPlane().execute(app);

        expect(rig.removedNodes).toHaveLength(3);
        expect(rig.removedNodes).toEqual(rig.addedNodes);
        for (const disposeSpy of rig.labelDisposeSpies) {
            expect(disposeSpy).toHaveBeenCalledTimes(1);
        }
        // No plane picked -> workplane untouched.
        expect(rig.view.workplaneVisible).toBe(false);
    });

    test.each([
        [0, Plane.XY], // TOP
        [1, Plane.ZX], // FRONT
        [2, Plane.YZ], // RIGHT
    ])("picking candidate %i sets the view's workplane and shows the grid", async (index, expectedPlane) => {
        const rig = buildRig();
        rig.pickIndex = index;
        const app = createMockApplication();
        app.activeView = rig.view;

        await new PickSketchPlane().execute(app);

        expect(rig.view.workplane.normal.isEqualTo(expectedPlane.normal)).toBe(true);
        expect(rig.view.workplane.xvec.isEqualTo(expectedPlane.xvec)).toBe(true);
        expect(rig.view.workplaneVisible).toBe(true);
        // Still cleaned up after a successful pick.
        expect(rig.removedNodes).toHaveLength(3);
        // The picker leaves the clicked plane selected (highlighted) - that
        // selection must be cleared or the outline lingers after the
        // temporary plane node is gone (nothing left to attach it to).
        // (SelectShapeStep itself also clears selection once up front, so
        // this is the second call - the one this command is responsible for.)
        expect(rig.doc.selection.clearSelection).toHaveBeenCalledTimes(2);
    });
});
