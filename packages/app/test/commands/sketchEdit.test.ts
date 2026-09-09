// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Plane, SketchGroupNode } from "@chili3d/core";
import { createMockApplication, createMockDocument, createMockView } from "@chili3d/core/test-utils";
import { describe, expect, rs, test } from "@rstest/core";
import { EditSketch } from "../../src/commands/sketchEdit";

describe("EditSketch", () => {
    test("should have command metadata", () => {
        const data = (EditSketch as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("sketch.edit");
        expect(data.icon).toBe("icon-edit");
    });

    test("should do nothing when there's no active view", async () => {
        const app = createMockApplication();
        app.activeView = undefined;

        await expect(new EditSketch().execute(app)).resolves.toBeUndefined();
    });

    test("should do nothing when the selection has no SketchGroupNode", async () => {
        const doc = createMockDocument({ selection: { getSelectedNodes: () => [] } });
        const view = createMockView({ document: doc });
        const app = createMockApplication();
        app.activeView = view;

        await new EditSketch().execute(app);

        expect(doc.modelManager.currentNode).toBeUndefined();
        expect(view.workplaneVisible).toBe(false);
    });

    test("should restore the working plane, resume the sketch and switch to the Sketch tab", async () => {
        const sketchPlane = new Plane({
            origin: Plane.ZX.origin,
            normal: Plane.ZX.normal,
            xvec: Plane.ZX.xvec,
        });
        const doc = createMockDocument();
        const sketchNode = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: sketchPlane });
        (doc.selection as any).getSelectedNodes = () => [sketchNode];
        const view = createMockView({ document: doc });
        const app = createMockApplication();
        app.activeView = view;
        const setActiveTab = rs.fn();
        (app as any).mainWindow = { ribbon: { setActiveTab } };

        await new EditSketch().execute(app);

        expect(view.workplane).toBe(sketchPlane);
        expect(view.workplaneVisible).toBe(true);
        expect(doc.modelManager.currentNode).toBe(sketchNode);
        expect(setActiveTab).toHaveBeenCalledWith("ribbon.tab.draw");
    });

    test("should ignore other selected nodes and pick the SketchGroupNode among them", async () => {
        const doc = createMockDocument();
        const sketchNode = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const other = { name: "Line" };
        (doc.selection as any).getSelectedNodes = () => [other, sketchNode];
        const view = createMockView({ document: doc });
        const app = createMockApplication();
        app.activeView = view;

        await new EditSketch().execute(app);

        expect(doc.modelManager.currentNode).toBe(sketchNode);
    });

    test("should not throw when there's no mainWindow", async () => {
        const doc = createMockDocument();
        const sketchNode = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        (doc.selection as any).getSelectedNodes = () => [sketchNode];
        const view = createMockView({ document: doc });
        const app = createMockApplication();
        app.activeView = view;

        await expect(new EditSketch().execute(app)).resolves.toBeUndefined();
    });
});
