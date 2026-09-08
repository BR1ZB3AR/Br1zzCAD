// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type IApplication, type ICommand, Plane, PubSub } from "@chili3d/core";
import { type PickablePlane, PlanePickerCube } from "@chili3d/element";

const PLANES: Record<PickablePlane, Plane> = {
    XY: Plane.XY,
    YZ: Plane.YZ,
    ZX: Plane.ZX,
};

@command({
    key: "sketch.pickPlane",
    icon: "icon-setWorkingPlane",
})
export class PickSketchPlane implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const view = application.activeView;
        if (!view) return;

        const cube = new PlanePickerCube((plane) => {
            view.workplane = PLANES[plane];
            view.workplaneVisible = true;
            // Picking a face is a definitive choice - close immediately
            // instead of waiting for a separate Confirm click.
            cube.closest("dialog")?.remove();
        });

        PubSub.default.pub("showDialog", "dialog.title.pickSketchPlane", cube, [
            { content: "common.cancel" },
        ]);
    }
}
