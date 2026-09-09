// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    command,
    EditableShapeNode,
    type IApplication,
    type ICommand,
    type IDisposable,
    type IFace,
    type IShape,
    type Matrix4,
    Plane,
    SelectShapeStep,
    ShapeTypes,
    SketchGroupNode,
    VisualStates,
    XYZ,
} from "@chili3d/core";

/** Session-wide counter, matching the established `Folder${index++}`
 * pattern (`create/folder.ts`) - not reset per document. */
let sketchIndex = 1;

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

        document.visual.context.addNode(nodes);
        for (const node of nodes) {
            const visual = document.visual.context.getVisual(node);
            if (visual) {
                document.visual.highlighter.addState(visual, VisualStates.faceTransparent, ShapeTypes.face);
            }
        }

        // All three planes share the same origin, so a label placed there
        // would overlap for all three - offset each one within its own
        // plane's surface (along that plane's own xvec/yvec, not its
        // normal) so it lands inside that plane's square instead of
        // drifting off toward the shared origin and the world axes there.
        const labelOffset = PLANE_SIZE * 0.28;
        const labels: IDisposable[] = CANDIDATES.map(({ label, plane }) =>
            view.htmlText(
                label,
                plane.origin.add(plane.xvec.multiply(labelOffset)).add(plane.yvec.multiply(labelOffset)),
                { hideDelete: true, center: { x: 0.5, y: 0.5 } },
            ),
        );

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
            // One of the three temporary reference planes -> use its exact
            // plane. Anything else -> the user clicked a real face on an
            // existing shape, so derive a plane from that face instead
            // (same face-to-plane math as `workingPlane.alignToPlane`).
            const plane = picked ? picked.plane : this.planeFromFace(data.shapes[0]);

            view.workplane = plane;
            view.workplaneVisible = true;

            // Everything drawn from here on (lines, rects, dimensions, ...)
            // routes through `modelManager.addNode`, which targets
            // `currentNode ?? rootNode` - making a new named group the
            // current node is what makes it collect this sketch's geometry
            // instead of scattering it at the document root.
            const sketchGroup = new SketchGroupNode({
                document,
                name: `Sketch ${sketchIndex++}`,
                plane,
            });
            document.modelManager.addNode(sketchGroup);
            document.modelManager.currentNode = sketchGroup;
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

    private planeFromFace(shapeData: { shape: IShape; transform: Matrix4 }) {
        const face = shapeData.shape.transformedMul(shapeData.transform) as IFace;
        const [point, normal] = face.normal(0, 0);
        face.dispose();
        let xvec = XYZ.unitX;
        if (!normal.isParallelTo(XYZ.unitZ)) {
            xvec = XYZ.unitZ.cross(normal).normalize()!;
        }
        return new Plane({ origin: point, normal, xvec });
    }
}
