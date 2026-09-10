// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GetOrSelectShapeStep,
    type IStep,
    MultistepCommand,
    PubSub,
    ShapeTypes,
    VerticalConstraint,
} from "@chili3d/core";
import { applyConstraint, findOwningSketch, resolveSketchPointHandles } from "./constraintUtils";

/** Forces the segment between two picked points to run parallel to the
 * sketch plane's own vertical (v) axis. */
@command({
    key: "constraint.vertical",
    icon: "icon-constraintVertical",
})
export class VerticalCommand extends MultistepCommand {
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
        applyConstraint(this.document, sketch, new VerticalConstraint({ p1, p2 }));
        this.document.visual.update();
    }
}
