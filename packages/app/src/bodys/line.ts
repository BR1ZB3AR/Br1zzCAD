// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    type IShapeMeshData,
    type ISketchPointOwner,
    ParameterShapeNode,
    property,
    type Result,
    serializable,
    serialize,
    type XYZ,
} from "@chili3d/core";
import { withProfileVertices } from "./profileVertices";

export interface LineOptions {
    document: IDocument;
    start: XYZ;
    end: XYZ;
}

const SKETCH_POINT_ROLES = ["start", "end"] as const;

@serializable()
export class LineNode extends ParameterShapeNode implements ISketchPointOwner {
    override display(): I18nKeys {
        return "body.line";
    }

    @serialize()
    @property("line.start")
    get start() {
        return this.getPrivateValue("start");
    }
    set start(pnt: XYZ) {
        this.setPropertyEmitShapeChanged("start", pnt);
    }

    @serialize()
    @property("line.end")
    get end() {
        return this.getPrivateValue("end");
    }
    set end(pnt: XYZ) {
        this.setPropertyEmitShapeChanged("end", pnt);
    }

    constructor(options: LineOptions) {
        super({ document: options.document });
        this.setPrivateValue("start", options.start);
        this.setPrivateValue("end", options.end);
    }

    generateShape(): Result<IShape, string> {
        return shapeFactory.line(this.start, this.end);
    }

    protected override createMesh(): IShapeMeshData {
        const mesh = super.createMesh();
        return this.shape.isOk ? withProfileVertices(mesh, this.shape.value) : mesh;
    }

    sketchPointRoles(): readonly string[] {
        return SKETCH_POINT_ROLES;
    }

    getSketchPoint(role: string): XYZ | undefined {
        if (role === "start") return this.start;
        if (role === "end") return this.end;
        return undefined;
    }

    setSketchPoint(role: string, point: XYZ): void {
        if (role === "start") this.start = point;
        else if (role === "end") this.end = point;
    }
}
