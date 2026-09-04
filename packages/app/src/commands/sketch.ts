// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type CommandKeys,
    I18n,
    type IApplication,
    type ICommand,
    Observable,
    Plane,
    PropertyUtils,
    PubSub,
    property,
    SelectableItems,
} from "@chili3d/core";
import { div, RadioGroup } from "@chili3d/element";

/** Top (XY) · Front (ZX) · Right (YZ) — same order as dialog radios. */
export const SKETCH_PLANES = [Plane.XY, Plane.ZX, Plane.YZ] as const;

/** 2D draw tools that require a sketch plane before they run. */
export const SKETCH_TOOL_KEYS: ReadonlySet<CommandKeys> = new Set([
    "create.line",
    "create.rect",
    "create.circle",
    "create.ellipse",
    "create.regularPolygon",
    "create.arc",
    "create.arc2point",
    "create.arc3point",
    "create.arcTTR",
    "create.point",
    "create.polygon",
    "create.bezier",
]);

let sketchPlaneChosen = false;

export function sketchPlaneLabels(): string[] {
    return [
        I18n.translate("sketch.plane.top"),
        I18n.translate("sketch.plane.front"),
        I18n.translate("sketch.plane.right"),
    ];
}

export function resetSketchPlaneGate(): void {
    sketchPlaneChosen = false;
}

/**
 * Ensures the user has picked Top/Front/Right for sketching.
 * Called before 2D create tools run.
 */
export function ensureSketchPlane(application: IApplication): Promise<boolean> {
    if (sketchPlaneChosen) {
        return Promise.resolve(true);
    }
    return pickSketchPlane(application);
}

function pickSketchPlane(application: IApplication): Promise<boolean> {
    const view = application.activeView;
    if (!view) {
        return Promise.resolve(false);
    }

    return new Promise((resolve) => {
        const vm = new SketchPlaneViewModel();
        let settled = false;
        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            resolve(ok);
        };

        PubSub.default.pub("showDialog", "dialog.title.selectSketchPlane", sketchPlaneUi(vm), [
            {
                content: "common.confirm",
                onclick: () => {
                    const index = vm.planes.selectedIndexes[0] ?? 0;
                    view.workplane = SKETCH_PLANES[index] ?? Plane.XY;
                    sketchPlaneChosen = true;
                    PubSub.default.pub("showToast", "toast.sketch.planeSet{0}", sketchPlaneLabels()[index] ?? "");
                    finish(true);
                },
            },
            {
                content: "common.cancel",
                onclick: () => {
                    PubSub.default.pub("showToast", "toast.sketch.selectPlane");
                    finish(false);
                },
            },
        ]);
    });
}

export class SketchPlaneViewModel extends Observable {
    @property("sketch.plane.label")
    planes: SelectableItems<string>;

    constructor() {
        super();
        const labels = sketchPlaneLabels();
        this.planes = new SelectableItems(labels, "radio", [labels[0]]);
    }
}

function sketchPlaneUi(vm: SketchPlaneViewModel) {
    return div(
        ...PropertyUtils.getProperties(vm).map((x) => {
            const value = (vm as any)[x.name];
            if (value instanceof SelectableItems) {
                return new RadioGroup(I18n.translate(x.display), value);
            }
            return "";
        }),
    );
}

/**
 * Ribbon Sketch button: force Top / Front / Right, then 2D tools are unlocked.
 */
@command({
    key: "create.sketch",
    icon: "icon-setWorkingPlane",
})
export class CreateSketch implements ICommand {
    async execute(application: IApplication): Promise<void> {
        // Always re-prompt so Sketch is the explicit plane-pick entry point.
        sketchPlaneChosen = false;
        await pickSketchPlane(application);
    }
}
