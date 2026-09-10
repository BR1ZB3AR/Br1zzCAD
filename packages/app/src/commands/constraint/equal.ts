// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    EqualConstraint,
    GetOrSelectShapeStep,
    type IStep,
    MultistepCommand,
    PubSub,
    ShapeTypes,
} from "@chili3d/core";
import { applyConstraint, findOwningSketch, resolveSketchPointHandles } from "./constraintUtils";

/** Forces two segments (4 picked points: each segment's own two endpoints,
 * in order) to the same length. */
@command({
    key: "constraint.equal",
    icon: "icon-constraintEqual",
})
export class EqualCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new GetOrSelectShapeStep(ShapeTypes.vertex, "prompt.select.vertexes", {
                multiple: true,
                canFinish: (selected) => selected.length >= 4,
            }),
        ];
    }

    protected override executeMainTask(): void {
        const handles = resolveSketchPointHandles(this.stepDatas[0]);
        if (handles.length < 4) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const owner = this.stepDatas[0].shapes[0].owner.node;
        const sketch = findOwningSketch(owner);
        if (!sketch) return;

        const [a1, a2, b1, b2] = handles;
        applyConstraint(this.document, sketch, new EqualConstraint({ a1, a2, b1, b2 }));
        this.document.visual.update();
    }
}
