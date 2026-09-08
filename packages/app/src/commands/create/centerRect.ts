// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { command, type GeometryNode, Plane, property, type XYZ } from "@chili3d/core";
import { RectNode } from "../../bodys";
import { RectCommandBase, type RectData } from "./rect";

@command({
    key: "create.centerRect",
    icon: "icon-rect",
})
export class CenterRect extends RectCommandBase {
    @property("option.command.isFace")
    public get isFace() {
        return this.getPrivateValue("isFace", true);
    }
    public set isFace(value: boolean) {
        this.setProperty("isFace", value);
    }

    protected override rectDataFromTwoSteps() {
        const rect = super.rectDataFromTwoSteps();
        this.recenter(rect);
        return rect;
    }

    protected override rectDataFromTemp(tmp: XYZ): RectData {
        const rect = super.rectDataFromTemp(tmp);
        this.recenter(rect);
        return rect;
    }

    private recenter(rect: RectData) {
        if (this.stepDatas.at(1)?.type !== "input") {
            rect.dx *= 2;
            rect.dy *= 2;
        }

        const { origin, xvec, yvec, normal } = rect.plane;
        rect.plane = new Plane({
            origin: origin.sub(xvec.multiply(rect.dx * 0.5)).sub(yvec.multiply(rect.dy * 0.5)),
            xvec,
            normal,
        });
    }

    protected override geometryNode(): GeometryNode {
        const { plane, dx, dy } = this.rectDataFromTwoSteps();
        const node = new RectNode({ document: this.document, plane, dx, dy });
        node.isFace = this.isFace;
        return node;
    }
}
