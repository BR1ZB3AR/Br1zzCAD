// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    FacebaseNode,
    type I18nKeys,
    type IDocument,
    type IShape,
    type IShapeMeshData,
    type ISketchPointOwner,
    type Plane,
    property,
    type Result,
    serializable,
    serialize,
    type XYZ,
} from "@chili3d/core";
import { withProfileVertices } from "./profileVertices";
import { sketchProfileMaterialId } from "./sketchMaterial";

export interface RectOptions {
    document: IDocument;
    plane: Plane;
    dx: number;
    dy: number;
}

const SKETCH_POINT_ROLES = ["corner0", "corner1", "corner2", "corner3"] as const;

@serializable()
export class RectNode extends FacebaseNode implements ISketchPointOwner {
    override display(): I18nKeys {
        return "body.rect";
    }

    @serialize()
    @property("rect.dx")
    get dx() {
        return this.getPrivateValue("dx");
    }
    set dx(dx: number) {
        this.setPropertyEmitShapeChanged("dx", dx);
    }

    @serialize()
    @property("rect.dy")
    get dy() {
        return this.getPrivateValue("dy");
    }
    set dy(dy: number) {
        this.setPropertyEmitShapeChanged("dy", dy);
    }

    @serialize()
    get plane(): Plane {
        return this.getPrivateValue("plane");
    }
    set plane(value: Plane) {
        this.setPropertyEmitShapeChanged("plane", value);
    }

    constructor(options: RectOptions) {
        super({ document: options.document, materialId: sketchProfileMaterialId(options.document) });
        this.setPrivateValue("plane", options.plane);
        this.setPrivateValue("dx", options.dx);
        this.setPrivateValue("dy", options.dy);
    }

    generateShape(): Result<IShape, string> {
        const points = RectNode.points(this.plane, this.dx, this.dy);
        const wire = shapeFactory.polygon(points);
        if (!wire.isOk || !this.isFace) return wire;
        return wire.value.toFace();
    }

    protected override createMesh(): IShapeMeshData {
        const mesh = super.createMesh();
        return this.shape.isOk ? withProfileVertices(mesh, this.shape.value) : mesh;
    }

    static points(plane: Plane, dx: number, dy: number): XYZ[] {
        const start = plane.origin;
        return [
            start,
            start.add(plane.xvec.multiply(dx)),
            start.add(plane.xvec.multiply(dx)).add(plane.yvec.multiply(dy)),
            start.add(plane.yvec.multiply(dy)),
            start,
        ];
    }

    sketchPointRoles(): readonly string[] {
        return SKETCH_POINT_ROLES;
    }

    getSketchPoint(role: string): XYZ | undefined {
        const [corner0, corner1, corner2, corner3] = RectNode.points(this.plane, this.dx, this.dy);
        switch (role) {
            case "corner0":
                return corner0;
            case "corner1":
                return corner1;
            case "corner2":
                return corner2;
            case "corner3":
                return corner3;
            default:
                return undefined;
        }
    }

    /**
     * Best-effort inverse of `points()` - a rect corner isn't an
     * independently-stored point, it's derived from `plane`/`dx`/`dy`, so
     * moving one corner can only ever change the one or two dimensions that
     * corner actually depends on:
     * - corner0 (the plane-origin corner) translates the whole rect.
     * - corner1/corner3 (adjacent to corner0) can only slide along one of
     *   the rect's own edges, recomputing just `dx` or just `dy`.
     * - corner2 (diagonal from corner0) recomputes both.
     * Any component of the requested point that falls outside what that
     * corner's own freedom allows (e.g. off-plane) is silently dropped,
     * matching `ISketchPointOwner.setSketchPoint`'s "best effort" contract.
     */
    setSketchPoint(role: string, point: XYZ): void {
        if (role === "corner0") {
            this.plane = this.plane.translateTo(point);
            return;
        }

        const offset = point.sub(this.plane.origin);
        if (role === "corner1") {
            this.dx = offset.dot(this.plane.xvec);
        } else if (role === "corner3") {
            this.dy = offset.dot(this.plane.yvec);
        } else if (role === "corner2") {
            this.dx = offset.dot(this.plane.xvec);
            this.dy = offset.dot(this.plane.yvec);
        }
    }
}
