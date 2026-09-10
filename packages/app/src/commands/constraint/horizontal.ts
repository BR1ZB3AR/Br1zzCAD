// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GetOrSelectShapeStep,
    HorizontalConstraint,
    type IStep,
    MultistepCommand,
    PubSub,
    ShapeTypes,
} from "@chili3d/core";
import { applyConstraint, findOwningSketch, resolveSketchPointHandles } from "./constraintUtils";

/** Forces the segment between two picked points to run parallel to the
 * sketch plane's own horizontal (u) axis. */
@command({
    key: "constraint.horizontal",
    icon: "icon-constraintHorizontal",
})
export class HorizontalCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new GetOrSelectShapeStep(ShapeTypes.vertex, "prompt.select.vertexes", {
                multiple: true,
                canFinish: (selected) => selected.length >= 2,
            }),
        ];
    }

    protected override executeMainTask(): void {
        const handles = resolveSketchPointHandles(this.stepDatas[0]);
        if (handles.length < 2) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const owner = this.stepDatas[0].shapes[0].owner.node;
        const sketch = findOwningSketch(owner);
        if (!sketch) return;

        const [p1, p2] = handles;
        applyConstraint(this.document, sketch, new HorizontalConstraint({ p1, p2 }));
        this.document.visual.update();
    }
}
