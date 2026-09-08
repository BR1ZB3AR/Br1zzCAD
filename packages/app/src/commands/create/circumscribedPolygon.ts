// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    type GeometryNode,
    type IStep,
    LengthAtPlaneStep,
    MathUtils,
    Plane,
    PointStep,
    Precision,
    property,
    type SnapLengthAtPlaneData,
    type XYZ,
} from "@chili3d/core";
import { RegularPolygonNode } from "../../bodys";
import { CreateFaceableCommand } from "../createCommand";

/**
 * Like RegularPolygon, but the picked radius is the apothem (the distance
 * to an edge midpoint - where the inscribed circle touches the polygon)
 * rather than the circumradius (distance to a vertex). The polygon this
 * produces circumscribes that circle, hence the name.
 */
@command({
    key: "create.circumscribedPolygon",
    icon: "icon-polygon",
})
export class CircumscribedPolygon extends CreateFaceableCommand {
    private _sides: number = 6;

    @property("regularPolygon.sides")
    public get sides() {
        return this._sides;
    }
    public set sides(value: number) {
        if (value >= 3) {
            this.setProperty("sides", value);
        }
    }

    getSteps(): IStep[] {
        const centerStep = new PointStep("prompt.pickCircleCenter");
        const radiusStep = new LengthAtPlaneStep("prompt.pickRadius", this.getRadiusData);
        return [centerStep, radiusStep];
    }

    private readonly getRadiusData = (): SnapLengthAtPlaneData => {
        const { point, view } = this.stepDatas[0];
        return {
            point: () => point!,
            preview: this.polygonPreview,
            plane: (tmp: XYZ | undefined) => this.findPlane(view, point!, tmp),
            validator: (p: XYZ) => {
                if (p.distanceTo(point!) < Precision.Distance) return false;
                const plane = this.findPlane(view, point!, p);
                return p.sub(point!).isParallelTo(plane.normal) === false;
            },
        };
    };

    /** The apothem-facing xvec (rotated half a step) and the circumradius that gives the picked apothem. */
    private tangentBasis(p1: XYZ, p2: XYZ) {
        const plane = this.getPlane(p1, p2);
        const apothem = plane.projectDistance(p1, p2);
        const halfStep = Math.PI / this._sides;
        const circumradius = apothem / Math.cos(halfStep);
        const xvec = plane.xvec.rotate(plane.normal, halfStep)!;
        return { plane, apothem, circumradius, xvec };
    }

    protected override geometryNode(): GeometryNode {
        const [p1, p2] = [this.stepDatas[0].point!, this.stepDatas[1].point!];
        const { plane, circumradius, xvec } = this.tangentBasis(p1, p2);
        const body = new RegularPolygonNode({
            document: this.document,
            normal: plane.normal,
            xvec,
            center: p1,
            radius: circumradius,
            sides: this._sides,
        });
        body.isFace = this.isFace;
        return body;
    }

    private readonly polygonPreview = (end: XYZ | undefined) => {
        if (!end) return [this.meshPoint(this.stepDatas[0].point!)];

        const { point } = this.stepDatas[0];
        const { plane, apothem, circumradius, xvec } = this.tangentBasis(point!, end);
        if (MathUtils.allEqualZero(apothem)) return [this.meshPoint(point!)];

        const vertices = RegularPolygonNode.calculateVertices(
            point!,
            circumradius,
            this._sides,
            plane.normal,
            xvec,
        );

        const meshes: ReturnType<typeof this.meshLine>[] = [];
        for (let i = 0; i < vertices.length - 1; i++) {
            meshes.push(this.meshLine(vertices[i], vertices[i + 1]));
        }

        return [this.meshPoint(point!), this.meshLine(point!, end), ...meshes];
    };

    protected getPlane(p1: XYZ, p2: XYZ) {
        const plane = this.findPlane(this.stepDatas[0].view, p1, p2);
        const radiusVec = p2.sub(p1);
        const yvec = plane.normal.cross(radiusVec).normalize()!;
        const xvec = yvec.cross(plane.normal).normalize()!;
        return new Plane({
            origin: p1,
            xvec: xvec,
            normal: plane.normal,
        });
    }
}
