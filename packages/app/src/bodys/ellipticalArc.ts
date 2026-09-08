// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    type IShapeMeshData,
    ParameterShapeNode,
    property,
    Result,
    serializable,
    serialize,
    type XYZ,
} from "@chili3d/core";
import { withProfileVertices } from "./profileVertices";

export interface EllipticalArcOptions {
    document: IDocument;
    normal: XYZ;
    center: XYZ;
    xvec: XYZ;
    majorRadius: number;
    minorRadius: number;
    startParameter: number;
    endParameter: number;
}

@serializable()
export class EllipticalArcNode extends ParameterShapeNode {
    override display(): I18nKeys {
        return "body.ellipticalArc";
    }

    @serialize()
    @property("circle.center")
    get center() {
        return this.getPrivateValue("center");
    }
    set center(center: XYZ) {
        this.setPropertyEmitShapeChanged("center", center);
    }

    @serialize()
    @property("ellipse.majorRadius")
    get majorRadius() {
        return this.getPrivateValue("majorRadius");
    }
    set majorRadius(radius: number) {
        this.setPropertyEmitShapeChanged("majorRadius", radius);
    }

    @serialize()
    @property("ellipse.minorRadius")
    get minorRadius() {
        return this.getPrivateValue("minorRadius");
    }
    set minorRadius(radius: number) {
        this.setPropertyEmitShapeChanged("minorRadius", radius);
    }

    @serialize()
    get normal(): XYZ {
        return this.getPrivateValue("normal");
    }

    @serialize()
    get xvec(): XYZ {
        return this.getPrivateValue("xvec");
    }

    @serialize()
    get startParameter(): number {
        return this.getPrivateValue("startParameter");
    }

    @serialize()
    get endParameter(): number {
        return this.getPrivateValue("endParameter");
    }

    constructor(options: EllipticalArcOptions) {
        super({ document: options.document });
        this.setPrivateValue("normal", options.normal);
        this.setPrivateValue("center", options.center);
        this.setPrivateValue("xvec", options.xvec);
        this.setPrivateValue("majorRadius", options.majorRadius);
        this.setPrivateValue("minorRadius", options.minorRadius);
        this.setPrivateValue("startParameter", options.startParameter);
        this.setPrivateValue("endParameter", options.endParameter);
    }

    generateShape(): Result<IShape, string> {
        const full = shapeFactory.ellipse(
            this.normal,
            this.center,
            this.xvec,
            this.majorRadius,
            this.minorRadius,
        );
        if (!full.isOk) return Result.err(full.error);

        const start = Math.min(this.startParameter, this.endParameter);
        const end = Math.max(this.startParameter, this.endParameter);
        const trimmed = full.value.curve.trim(start, end);
        return Result.ok(shapeFactory.edge(trimmed));
    }

    protected override createMesh(): IShapeMeshData {
        const mesh = super.createMesh();
        return this.shape.isOk ? withProfileVertices(mesh, this.shape.value) : mesh;
    }
}
