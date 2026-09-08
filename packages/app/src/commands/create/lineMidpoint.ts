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
import { LineNode } from "../../bodys";
import { CreateCommand } from "../createCommand";

@command({
    key: "create.lineMidpoint",
    icon: "icon-line",
})
export class LineMidpoint extends CreateCommand {
    protected override geometryNode(): GeometryNode {
        const [start, end] = this.endpoints(this.stepDatas[1].point!);
        return new LineNode({ document: this.document, start, end });
    }

    private endpoints(pick: XYZ): [XYZ, XYZ] {
        const mid = this.stepDatas[0].point!;
        const offset = pick.sub(mid);
        return [mid.sub(offset), mid.add(offset)];
    }

    getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickCircleCenter"),
            new PointStep("prompt.pickNextPoint", this.getSecondPointData),
        ];
    }

    private readonly getSecondPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[0].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => {
                return this.stepDatas[0].point!.distanceTo(point) > Precision.Distance;
            },
            preview: this.linePreview,
        };
    };

    private readonly linePreview = (point: XYZ | undefined) => {
        if (!point) {
            return [this.meshPoint(this.stepDatas[0].point!)];
        }
        const [start, end] = this.endpoints(point);
        return [this.meshPoint(this.stepDatas[0].point!), this.meshLine(start, end)];
    };
}
