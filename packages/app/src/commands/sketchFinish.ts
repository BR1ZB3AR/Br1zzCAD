// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IApplication, type ICommand } from "@chili3d/core";

/**
 * Ends the current sketch: stops routing new geometry into its "Sketch N"
 * group (`PickSketchPlane` set it as `modelManager.currentNode`) and
 * switches to the Model tab, where the finished sketch can be extruded,
 * revolved, etc. Safe to invoke even when no sketch is active - resetting
 * `currentNode` to root and switching tabs are both no-ops in that case.
 */
@command({
    key: "sketch.finish",
    icon: "icon-confirm",
})
export class FinishSketch implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        document.modelManager.currentNode = undefined;
        app.mainWindow?.ribbon.setActiveTab("ribbon.tab.model");
    }
}
