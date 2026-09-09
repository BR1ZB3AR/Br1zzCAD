// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    DimensionAnnotation,
    Dimensions,
    type DimensionType,
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
import { circleFromEdge, circleNodeEditHandler, circularEdgeFilter } from "./dimensionUtils";

/**
 * Shared logic for the Radius and Diameter dimension tools: pick a circular
 * edge, then a placement point. Only a CircleNode's own edge can be edited
 * back (its `radius` is a plain settable property); a circular edge from
 * anywhere else (an Arc, a filleted corner, ...) still gets measured, just
 * read-only.
 */
export abstract class RadialDimensionCommandBase extends MultistepCommand {
    protected abstract readonly dimensionType: Extract<DimensionType, "radial" | "diameter">;

    protected override executeMainTask(): void {
        const edgeData = this.stepDatas[0].shapes[0];
        const edge = this.transformdFirstShape(this.stepDatas[0]) as IEdge;
        const circle = circleFromEdge(edge);
        if (!circle) return;

        const center = circle.center;
        const onCircle = center.add(circle.xAxis.multiply(circle.radius));
        const placement = this.stepDatas[1].point!;

        Transaction.execute(this.document, "create dimension", () => {
            const annotation = new DimensionAnnotation({
                document: this.document,
                name: "Dimension",
                annotationType: "dimension",
                dimensionType: this.dimensionType,
                startPoint: center,
                endPoint: onCircle,
                placement,
            });
            this.document.modelManager.addNode(annotation);
            setDimensionMeasuredNodes(annotation, [edgeData.owner.node]);

            const handler = circleNodeEditHandler(
                annotation,
                edgeData.owner.node,
                center,
                onCircle,
                this.dimensionType,
            );
            if (handler) setDimensionEditHandler(annotation, handler);

            this.document.visual.update();
        });
        this.repeatOperation = true;
    }

    getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                shapeFilter: circularEdgeFilter,
            }),
            new PointStep("prompt.pickNextPoint", this.getPlacementData),
        ];
    }

    private readonly getPlacementData = (): PointSnapData => {
        return { dimension: Dimensions.D1D2D3 };
    };
}

@command({
    key: "create.dimensionRadius",
    icon: "icon-measureLength",
})
export class RadiusDimension extends RadialDimensionCommandBase {
    protected readonly dimensionType = "radial" as const;
}

@command({
    key: "create.dimensionDiameter",
    icon: "icon-measureLength",
})
export class DiameterDimension extends RadialDimensionCommandBase {
    protected readonly dimensionType = "diameter" as const;
}
