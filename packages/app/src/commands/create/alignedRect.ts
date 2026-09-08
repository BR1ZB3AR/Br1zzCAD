// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    type GeometryNode,
    type IStep,
    MathUtils,
    Plane,
    type PointSnapData,
    PointStep,
    Precision,
    property,
    type XYZ,
} from "@chili3d/core";
import { RectNode } from "../../bodys";
import { CreateCommand } from "../createCommand";
import type { RectData } from "./rect";

/**
 * A 3-point rectangle: the first two points set a corner and the direction/
 * length of one edge (so the rectangle can sit at any angle in the
 * workplane, not just axis-aligned), the third sets the perpendicular width.
 */
@command({
    key: "create.alignedRect",
    icon: "icon-rect",
})
export class AlignedRect extends CreateCommand {
    @property("option.command.isFace")
    public get isFace() {
        return this.getPrivateValue("isFace", true);
    }
    public set isFace(value: boolean) {
        this.setProperty("isFace", value);
    }

    protected getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickNextPoint", this.getEdgePointData),
            new PointStep("prompt.pickNextPoint", this.getWidthPointData),
        ];
    }

    private readonly getEdgePointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[0].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => this.stepDatas[0].point!.distanceTo(point) > Precision.Distance,
            preview: (point: XYZ | undefined) => {
                if (!point) return [this.meshPoint(this.stepDatas[0].point!)];
                return [
                    this.meshPoint(this.stepDatas[0].point!),
                    this.meshLine(this.stepDatas[0].point!, point),
                ];
            },
        };
    };

    private readonly getWidthPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[1].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => {
                const { dx, dy } = this.rectData(this.stepDatas[0].point!, this.stepDatas[1].point!, point);
                return !MathUtils.anyEqualZero(dx, dy);
            },
            preview: (point: XYZ | undefined) => {
                if (!point) {
                    return [
                        this.meshPoint(this.stepDatas[0].point!),
                        this.meshLine(this.stepDatas[0].point!, this.stepDatas[1].point!),
                    ];
                }
                const { plane, dx, dy } = this.rectData(
                    this.stepDatas[0].point!,
                    this.stepDatas[1].point!,
                    point,
                );
                return [
                    this.meshPoint(this.stepDatas[0].point!),
                    this.meshPoint(this.stepDatas[1].point!),
                    this.meshCreatedShape("rect", plane, dx, dy),
                ];
            },
        };
    };

    private rectData(corner: XYZ, edgeEnd: XYZ, widthPoint: XYZ): RectData {
        const workplane = this.stepDatas[0].view.workplane.translateTo(corner);
        const edge = edgeEnd.sub(corner);
        const dx = edge.length();
        const xvec = dx > Precision.Distance ? edge.normalize()! : workplane.xvec;
        const plane = new Plane({ origin: corner, normal: workplane.normal, xvec });
        const dy = widthPoint.sub(corner).dot(plane.yvec);
        return { plane, dx, dy };
    }

    protected override geometryNode(): GeometryNode {
        const { plane, dx, dy } = this.rectData(
            this.stepDatas[0].point!,
            this.stepDatas[1].point!,
            this.stepDatas[2].point!,
        );
        const node = new RectNode({ document: this.document, plane, dx, dy });
        node.isFace = this.isFace;
        return node;
    }
}
