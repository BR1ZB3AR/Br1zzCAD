// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IApplication, type ICommand, SketchGroupNode } from "@chili3d/core";

/**
 * Re-enters an existing sketch from the Items tree - the inverse of
 * `sketch.finish`. Restores the working plane it was created on (stored on
 * the `SketchGroupNode` itself), resumes routing new geometry into it, and
 * switches back to the Sketch tab.
 */
@command({
    key: "sketch.edit",
    icon: "icon-edit",
})
export class EditSketch implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const view = app.activeView;
        const document = view?.document;
        if (!view || !document) return;

        const target = document.selection
            .getSelectedNodes()
            .find((node): node is SketchGroupNode => node instanceof SketchGroupNode);
        if (!target) return;

        view.workplane = target.plane;
        view.workplaneVisible = true;
        document.modelManager.currentNode = target;
        app.mainWindow?.ribbon.setActiveTab("ribbon.tab.draw");
    }
}
