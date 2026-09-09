// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { GroupNode } from "@chili3d/core";
import { createMockApplication, createMockDocument, createMockView } from "@chili3d/core/test-utils";
import { describe, expect, rs, test } from "@rstest/core";
import { FinishSketch } from "../../src/commands/sketchFinish";

describe("FinishSketch", () => {
    test("should have command metadata", () => {
        const data = (FinishSketch as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("sketch.finish");
        expect(data.icon).toBe("icon-confirm");
    });

    test("should do nothing when there's no active view", async () => {
        const app = createMockApplication();
        app.activeView = undefined;

        await expect(new FinishSketch().execute(app)).resolves.toBeUndefined();
    });

    test("should reset modelManager.currentNode to undefined", async () => {
        const doc = createMockDocument();
        (doc.modelManager as any).currentNode = { name: "Sketch 1" } as GroupNode;
        const view = createMockView({ document: doc });
        const app = createMockApplication();
        app.activeView = view;

        await new FinishSketch().execute(app);

        expect(doc.modelManager.currentNode).toBeUndefined();
    });

    test("should switch the ribbon to the Model tab when a mainWindow is present", async () => {
        const doc = createMockDocument();
        const view = createMockView({ document: doc });
        const app = createMockApplication();
        app.activeView = view;
        const setActiveTab = rs.fn();
        (app as any).mainWindow = { ribbon: { setActiveTab } };

        await new FinishSketch().execute(app);

        expect(setActiveTab).toHaveBeenCalledWith("ribbon.tab.model");
    });

    test("should not throw when there's no mainWindow", async () => {
        const doc = createMockDocument();
        const view = createMockView({ document: doc });
        const app = createMockApplication();
        app.activeView = view;
        // createMockApplication doesn't set mainWindow at all by default.

        await expect(new FinishSketch().execute(app)).resolves.toBeUndefined();
    });
});
