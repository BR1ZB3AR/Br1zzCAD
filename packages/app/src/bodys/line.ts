// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type I18nKeys,
    type IDocument,
    type IShape,
    type IShapeMeshData,
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

@serializable()
export class LineNode extends ParameterShapeNode {
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

    /** A reference/guide line (dashed) rather than real sketch profile
     * geometry - purely a rendering style, so toggling it mutates the
     * already-built mesh directly instead of regenerating the OCCT shape. */
    @serialize()
    @property("common.isConstruction")
    get isConstruction(): boolean {
        return this.getPrivateValue("isConstruction", false);
    }
    set isConstruction(value: boolean) {
        if (!this.setProperty("isConstruction", value)) return;
        if (this.mesh.edges) {
            this.mesh.edges.lineType = value ? "dash" : "solid";
        }
        this.document.visual.context.redrawNode([this]);
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
        const withVertices = this.shape.isOk ? withProfileVertices(mesh, this.shape.value) : mesh;
        if (this.isConstruction && withVertices.edges) {
            withVertices.edges.lineType = "dash";
        }
        return withVertices;
    }
}
