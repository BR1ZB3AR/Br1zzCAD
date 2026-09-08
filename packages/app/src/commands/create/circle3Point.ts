// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    type GeometryNode,
    type IStep,
    type PointSnapData,
    PointStep,
    Precision,
    type XYZ,
} from "@chili3d/core";
import { CircleNode } from "../../bodys";
import { CreateFaceableCommand } from "../createCommand";
import { computeCircleFromPoints } from "./arcUtils";

@command({
    key: "create.circle3Point",
    icon: "icon-circle",
})
export class Circle3Point extends CreateFaceableCommand {
    getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickArcEnd", this.getSecondPointData),
            new PointStep("prompt.pickArcMid", this.getThirdPointData),
        ];
    }

    private readonly getSecondPointData = (): PointSnapData => {
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

    private readonly getThirdPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[1].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => {
                return (
                    computeCircleFromPoints(this.stepDatas[0].point!, this.stepDatas[1].point!, point) !==
                    undefined
                );
            },
            preview: this.circlePreview,
        };
    };

    private readonly circlePreview = (point: XYZ | undefined) => {
        const [p0, p1] = [this.stepDatas[0].point!, this.stepDatas[1].point!];
        const base = [this.meshPoint(p0), this.meshPoint(p1)];
        if (!point) return base;

        const circle = computeCircleFromPoints(p0, p1, point);
        if (!circle) return [...base, this.meshPoint(point)];

        const radius = circle.center.distanceTo(p0);
        return [
            ...base,
            this.meshPoint(point),
            this.meshCreatedShape("circle", circle.normal, circle.center, radius),
        ];
    };

    protected override geometryNode(): GeometryNode {
        const [p0, p1, p2] = [this.stepDatas[0].point!, this.stepDatas[1].point!, this.stepDatas[2].point!];
        const circle = computeCircleFromPoints(p0, p1, p2)!;
        const node = new CircleNode({
            document: this.document,
            normal: circle.normal,
            center: circle.center,
            radius: circle.center.distanceTo(p0),
        });
        node.isFace = this.isFace;
        return node;
    }
}
