// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    DistanceConstraint,
    GetOrSelectShapeStep,
    type IStep,
    isSketchPointOwner,
    MultistepCommand,
    NodeUtils,
    PubSub,
    ShapeTypes,
} from "@chili3d/core";
import { applyConstraint, findOwningSketch, resolveSketchPointHandles } from "./constraintUtils";

/** Pins the distance between two picked points to their current distance -
 * a named, editable dimensional parameter (see `SketchConstraintNode`'s
 * `distance` accessor) rather than a fixed structural relationship, unlike
 * every other constraint kind. */
@command({
    key: "constraint.distance",
    icon: "icon-constraintDistance",
})
export class DistanceCommand extends MultistepCommand {
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
        const owner1 = NodeUtils.findNode(sketch, (n) => n.id === p1.nodeId);
        const owner2 = NodeUtils.findNode(sketch, (n) => n.id === p2.nodeId);
        if (!owner1 || !owner2 || !isSketchPointOwner(owner1) || !isSketchPointOwner(owner2)) return;

        const point1 = owner1.getSketchPoint(p1.role);
        const point2 = owner2.getSketchPoint(p2.role);
        if (!point1 || !point2) return;

        applyConstraint(
            this.document,
            sketch,
            new DistanceConstraint({ p1, p2, distance: point1.distanceTo(point2) }),
        );
        this.document.visual.update();
    }
}
