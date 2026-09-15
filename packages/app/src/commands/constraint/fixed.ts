// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    FixedConstraint,
    GetOrSelectShapeStep,
    type IStep,
    isSketchPointOwner,
    MultistepCommand,
    PubSub,
    ShapeTypes,
} from "@chili3d/core";
import { applyConstraint, findOwningSketch, resolveSketchPointHandles } from "./constraintUtils";

/** Pins one picked point to its current location - the only constraint
 * kind that anchors absolute position rather than a relationship between
 * points, removing the rigid-body translation freedom a sketch otherwise
 * always retains no matter how thoroughly it's otherwise constrained. */
@command({
    key: "constraint.fixed",
    icon: "icon-constraintFixed",
})
export class FixedCommand extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [
            new GetOrSelectShapeStep(ShapeTypes.vertex, "prompt.select.vertexes", {
                multiple: true,
                canFinish: (selected) => selected.length >= 1,
            }),
        ];
    }

    protected override executeMainTask(): void {
        const handles = resolveSketchPointHandles(this.stepDatas[0]);
        if (handles.length < 1) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        const owner = this.stepDatas[0].shapes[0].owner.node;
        const sketch = findOwningSketch(owner);
        if (!sketch || !isSketchPointOwner(owner)) return;

        const [p1] = handles;
        const point = owner.getSketchPoint(p1.role);
        if (!point) return;

        const { u, v } = sketch.plane.toUV(point);
        applyConstraint(this.document, sketch, new FixedConstraint({ p1, u, v }));
        this.document.visual.update();
    }
}
