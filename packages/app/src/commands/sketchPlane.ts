// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    command,
    EditableShapeNode,
    type IApplication,
    type ICommand,
    type IDisposable,
    Plane,
    SelectShapeStep,
    ShapeTypes,
} from "@chili3d/core";

/** Size (mm) of each temporary reference plane shown for picking - matches
 * the world-origin AxesHelper's own fixed size, so it reads as one coherent
 * "origin" indicator regardless of how big or small the actual model is. */
const PLANE_SIZE = 300;

const CANDIDATES: { label: string; plane: Plane }[] = [
    { label: "TOP", plane: Plane.XY },
    { label: "FRONT", plane: Plane.ZX },
    { label: "RIGHT", plane: Plane.YZ },
];

function centeredOn(plane: Plane, size: number): Plane {
    const half = size / 2;
    const origin = plane.origin.sub(plane.xvec.multiply(half)).sub(plane.yvec.multiply(half));
    return new Plane({ origin, normal: plane.normal, xvec: plane.xvec });
}

@command({
    key: "sketch.pickPlane",
    icon: "icon-setWorkingPlane",
})
export class PickSketchPlane implements ICommand {
    async execute(application: IApplication): Promise<void> {
        const view = application.activeView;
        if (!view) return;
        const document = view.document;

        const nodes = CANDIDATES.map(
            ({ label, plane }) =>
                new EditableShapeNode({
                    document,
                    name: `sketch-plane-picker-${label}`,
                    shape: shapeFactory.rect(centeredOn(plane, PLANE_SIZE), PLANE_SIZE, PLANE_SIZE),
                }),
        );
        // All three planes share the same origin, so a label placed there would
        // overlap for all three - push each one out along its own normal
        // instead, landing it just past its plane's edge.
        const labels: IDisposable[] = CANDIDATES.map(({ label, plane }) =>
            view.htmlText(label, plane.origin.add(plane.normal.multiply(PLANE_SIZE * 0.55)), {
                hideDelete: true,
                center: { x: 0.5, y: 0.5 },
            }),
        );

        document.visual.context.addNode(nodes);
        document.visual.update();

        const controller = new AsyncController();
        try {
            const data = await new SelectShapeStep(ShapeTypes.face, "prompt.select.sketchPlane").execute(
                document,
                controller,
            );
            if (!data || data.shapes.length === 0) return;

            const pickedNode = data.shapes[0].owner.node;
            const picked = CANDIDATES.find((_, i) => nodes[i] === pickedNode);
            if (!picked) return;

            view.workplane = picked.plane;
            view.workplaneVisible = true;
        } finally {
            controller.dispose();
            // The picker leaves the clicked shape selected (a highlighted
            // outline) - clear it before removing the shape itself, or the
            // outline lingers with nothing left to attach it to.
            document.selection.clearSelection();
            document.visual.context.removeNode(nodes);
            labels.forEach((l) => l.dispose());
            view.update();
        }
    }
}
