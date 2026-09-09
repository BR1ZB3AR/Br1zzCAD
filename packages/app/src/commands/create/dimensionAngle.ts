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
    setDimensionMeasuredNodes,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { straightEdgeFilter } from "./dimensionUtils";

/**
 * Creates a read-only angle dimension between two picked straight edges - an
 * arc with arrows sweeping from one edge's direction to the other's, labeled
 * in degrees. The shared vertex is whichever pair of endpoints (one from
 * each edge) sits closest together; that covers the common case (two sides
 * of a Rectangle/Polygon meeting at a corner) without needing a general
 * line-line intersection. Unlike Linear/Radius/Diameter, this isn't
 * editable yet - the corner of a Rectangle is fixed at 90° by construction,
 * and driving an angle between two independent Lines would need to decide
 * which one rotates and about what pivot, which nothing has asked for yet.
 */
@command({
    key: "create.dimensionAngle",
    icon: "icon-measureAngle",
})
export class AngleDimension extends MultistepCommand {
    protected override executeMainTask(): void {
        const edge1 = this.transformdFirstShape(this.stepDatas[0]) as IEdge;
        const edge2 = this.transformdFirstShape(this.stepDatas[1]) as IEdge;
        const { vertex, point1, point2 } = this.nearestVertexPairing(edge1, edge2);
        const placement = this.stepDatas[2].point!;

        Transaction.execute(this.document, "create dimension", () => {
            const annotation = new DimensionAnnotation({
                document: this.document,
                name: "Dimension",
                annotationType: "dimension",
                dimensionType: "angle",
                startPoint: vertex,
                endPoint: point1,
                point2,
                placement,
            });
            this.document.modelManager.addNode(annotation);
            setDimensionMeasuredNodes(annotation, [
                this.stepDatas[0].shapes[0].owner.node,
                this.stepDatas[1].shapes[0].owner.node,
            ]);
            this.document.visual.update();
        });
        this.repeatOperation = true;
    }

    private nearestVertexPairing(edge1: IEdge, edge2: IEdge): { vertex: XYZ; point1: XYZ; point2: XYZ } {
        const a1 = edge1.curve.startPoint();
        const a2 = edge1.curve.endPoint();
        const b1 = edge2.curve.startPoint();
        const b2 = edge2.curve.endPoint();

        const pairs: Array<[XYZ, XYZ, XYZ, XYZ]> = [
            [a1, a2, b1, b2],
            [a1, a2, b2, b1],
            [a2, a1, b1, b2],
            [a2, a1, b2, b1],
        ];
        let best = pairs[0];
        let bestDistance = pairs[0][0].distanceTo(pairs[0][2]);
        for (const pair of pairs.slice(1)) {
            const distance = pair[0].distanceTo(pair[2]);
            if (distance < bestDistance) {
                best = pair;
                bestDistance = distance;
            }
        }

        const [vertex1, point1, vertex2, point2] = best;
        // Average the two edges' near endpoints in case they don't share an
        // exact point (e.g. slightly offset from each other).
        return { vertex: vertex1.add(vertex2).multiply(0.5), point1, point2 };
    }

    getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                shapeFilter: straightEdgeFilter,
            }),
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
