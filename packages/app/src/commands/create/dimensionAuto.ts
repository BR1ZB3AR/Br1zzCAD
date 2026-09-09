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
    type XYZ,
} from "@chili3d/core";
import { circleFromEdge, circleNodeEditHandler, linearEdgeEditHandler } from "./dimensionUtils";

/**
 * The default Dimension tool: pick any edge, then a placement point, and it
 * picks the dimension type for you - a circular edge gets a Diameter
 * dimension (the conventional default circle callout), anything else gets
 * a Linear one measuring the straight-line distance between its endpoints.
 * Covers the two most common cases without asking which tool to use first;
 * Radius and Angle stay as their own explicit tools in the dropdown.
 */
@command({
    key: "create.dimensionAuto",
    icon: "icon-measureLength",
})
export class AutoDimension extends MultistepCommand {
    protected override executeMainTask(): void {
        const edgeData = this.stepDatas[0].shapes[0];
        const edge = this.transformdFirstShape(this.stepDatas[0]) as IEdge;
        const placement = this.stepDatas[1].point!;
        const circle = circleFromEdge(edge);

        Transaction.execute(this.document, "create dimension", () => {
            const annotation = circle
                ? this.createDiameter(circle, placement)
                : this.createLinear(edge, placement);
            this.document.modelManager.addNode(annotation);
            setDimensionMeasuredNodes(annotation, [edgeData.owner.node]);

            const handler = circle
                ? circleNodeEditHandler(
                      annotation,
                      edgeData.owner.node,
                      annotation.startPoint,
                      annotation.endPoint,
                      "diameter",
                  )
                : linearEdgeEditHandler(
                      annotation,
                      edgeData.owner.node,
                      annotation.startPoint,
                      annotation.endPoint,
                  );
            if (handler) setDimensionEditHandler(annotation, handler);

            this.document.visual.update();
        });
        this.repeatOperation = true;
    }

    private createLinear(edge: IEdge, placement: XYZ): DimensionAnnotation {
        return new DimensionAnnotation({
            document: this.document,
            name: "Dimension",
            annotationType: "dimension",
            dimensionType: "linear",
            startPoint: edge.curve.startPoint(),
            endPoint: edge.curve.endPoint(),
            placement,
        });
    }

    private createDiameter(
        circle: NonNullable<ReturnType<typeof circleFromEdge>>,
        placement: XYZ,
    ): DimensionAnnotation {
        const center = circle.center;
        const onCircle = center.add(circle.xAxis.multiply(circle.radius));
        return new DimensionAnnotation({
            document: this.document,
            name: "Dimension",
            annotationType: "dimension",
            dimensionType: "diameter",
            startPoint: center,
            endPoint: onCircle,
            placement,
        });
    }

    getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges"),
            new PointStep("prompt.pickNextPoint", this.getPlacementData),
        ];
    }

    private readonly getPlacementData = (): PointSnapData => {
        return { dimension: Dimensions.D1D2D3 };
    };
}
