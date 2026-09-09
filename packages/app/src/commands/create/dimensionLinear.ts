// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    DimensionAnnotation,
    Dimensions,
    type IEdge,
    type IStep,
    MultistepCommand,
    type PointSnapData,
    PointStep,
    SelectShapeStep,
    ShapeTypes,
    setDimensionEditHandler,
    setDimensionMeasuredNodes,
    Transaction,
} from "@chili3d/core";
import { linearEdgeEditHandler, straightEdgeFilter } from "./dimensionUtils";

/**
 * Creates an editable linear dimension by picking a straight edge directly
 * (a Line, or one side of a Rectangle/Polygon), then a placement point - no
 * separate node-to-node point-clicking, which is fragile against the same
 * pixel not resolving to the same vertex snap twice. When the picked edge
 * belongs to a LineNode or a RectNode, double-clicking the dimension's label
 * later can edit that line's length or that rectangle's dx/dy; an edge from
 * anywhere else still gets measured, just read-only.
 */
@command({
    key: "create.dimensionLinear",
    icon: "icon-measureLength",
})
export class LinearDimension extends MultistepCommand {
    protected override executeMainTask(): void {
        const edgeData = this.stepDatas[0].shapes[0];
        const edge = this.transformdFirstShape(this.stepDatas[0]) as IEdge;
        const start = edge.curve.startPoint();
        const end = edge.curve.endPoint();
        const placement = this.stepDatas[1].point!;

        Transaction.execute(this.document, "create dimension", () => {
            const annotation = new DimensionAnnotation({
                document: this.document,
                name: "Dimension",
                annotationType: "dimension",
                dimensionType: "linear",
                startPoint: start,
                endPoint: end,
                placement,
            });
            this.document.modelManager.addNode(annotation);
            setDimensionMeasuredNodes(annotation, [edgeData.owner.node]);

            const handler = linearEdgeEditHandler(annotation, edgeData.owner.node, start, end);
            if (handler) setDimensionEditHandler(annotation, handler);

            this.document.visual.update();
        });
        this.repeatOperation = true;
    }

    getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                shapeFilter: straightEdgeFilter,
            }),
            new PointStep("prompt.pickNextPoint", this.getPlacementData),
        ];
    }

    private readonly getPlacementData = (): PointSnapData => {
        return { dimension: Dimensions.D1D2D3 };
    };
}
