// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    type GeometryNode,
    type IStep,
    type LengthAtAxisSnapData,
    LengthAtAxisStep,
    LengthAtPlaneStep,
    type PointSnapData,
    PointStep,
    Precision,
    type SnapLengthAtPlaneData,
    type XYZ,
} from "@chili3d/core";
import { EllipticalArcNode } from "../../bodys/ellipticalArc";
import { CreateCommand } from "../createCommand";

/**
 * Center, major-axis point, minor-axis point (same first three steps as
 * Ellipse), then a start and end point picked near the ellipse - each
 * snapped to the curve itself so the resulting arc's parameters are exact.
 */
@command({
    key: "create.ellipticalArc",
    icon: "icon-ellipse",
})
export class EllipticalArc extends CreateCommand {
    getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickCircleCenter"),
            new LengthAtPlaneStep("prompt.pickRadius", this.getMajorRadiusData),
            new LengthAtAxisStep("prompt.pickRadius", this.getMinorRadiusData),
            new PointStep("prompt.pickFistPoint", this.getStartPointData),
            new PointStep("prompt.pickNextPoint", this.getEndPointData),
        ];
    }

    private readonly getMajorRadiusData = (): SnapLengthAtPlaneData => {
        const point = this.stepDatas[0].point!;
        return {
            point: () => point,
            preview: this.previewCircle,
            plane: (tmp: XYZ | undefined) => this.findPlane(this.stepDatas[0].view, point, tmp),
            validator: this.validateRadiusPoint,
        };
    };

    private readonly validateRadiusPoint = (point: XYZ) => {
        const center = this.stepDatas[0].point!;
        if (point.distanceTo(center) < Precision.Distance) return false;
        const plane = this.findPlane(this.stepDatas[0].view, center, point);
        return point.sub(center).isParallelTo(plane.normal) === false;
    };

    private readonly previewCircle = (end: XYZ | undefined) => {
        if (end === undefined) return [this.meshPoint(this.stepDatas[0].point!)];
        const plane = this.findPlane(this.stepDatas[0].view, this.stepDatas[0].point!, end);
        return [
            this.meshPoint(this.stepDatas[0].point!),
            this.meshPoint(end),
            this.meshCreatedShape(
                "circle",
                plane.normal,
                this.stepDatas[0].point!,
                end.distanceTo(this.stepDatas[0].point!),
            ),
        ];
    };

    private readonly getMinorRadiusData = (): LengthAtAxisSnapData => {
        const point = this.stepDatas[0].point!;
        const plane = this.stepDatas[1].plane!;
        const direction = plane.normal.cross(this.stepDatas[1].point!.sub(point)).normalize()!;
        return {
            point,
            preview: this.ellipsePreview,
            direction,
            validator: this.validateRadiusPoint,
        };
    };

    /**
     * `minorPoint` defaults to the (by-then finalized) step 2 point - but
     * during step 2's OWN live preview, stepDatas[2] doesn't exist yet, so
     * ellipsePreview passes the in-progress mouse position explicitly here
     * instead (matching how Ellipse.ellipsePreview never reads stepDatas[2]).
     */
    private ellipseParams(minorPoint: XYZ = this.stepDatas[2]?.point!) {
        const [p0, p1] = [this.stepDatas[0].point!, this.stepDatas[1].point!];
        const plane = this.stepDatas[1].plane!;
        const d1 = plane.projectDistance(p0, p1);
        const d2 = plane.projectDistance(p0, minorPoint);
        return {
            normal: plane.normal,
            center: p0,
            xvec: p1.sub(p0),
            majorRadius: d1,
            minorRadius: d2 > d1 ? d1 : d2,
        };
    }

    private readonly ellipsePreview = (point: XYZ | undefined) => {
        if (!point) return this.previewCircle(this.stepDatas[1].point);
        const { normal, center, xvec, majorRadius, minorRadius } = this.ellipseParams(point);
        return [
            this.meshPoint(this.stepDatas[0].point!),
            this.meshPoint(this.stepDatas[1].point!),
            this.meshCreatedShape("ellipse", normal, center, xvec, majorRadius, minorRadius),
        ];
    };

    /** Full ellipse edge + curve for the current center/major/minor steps - rebuilt each time it's needed. */
    private fullEllipse() {
        const { normal, center, xvec, majorRadius, minorRadius } = this.ellipseParams();
        return shapeFactory.ellipse(normal, center, xvec, majorRadius, minorRadius);
    }

    private parameterNear(point: XYZ): number | undefined {
        const full = this.fullEllipse();
        if (!full.isOk) return undefined;
        const curve = full.value.curve;
        const projected = curve.project(point).at(0) ?? point;
        return curve.parameter(projected, Precision.Distance);
    }

    private readonly getStartPointData = (): PointSnapData => {
        return {
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => this.parameterNear(point) !== undefined,
            preview: (point: XYZ | undefined) => {
                const base = [
                    this.meshPoint(this.stepDatas[0].point!),
                    this.ellipsePreview(this.stepDatas[2].point)[2],
                ];
                return point ? [...base, this.meshPoint(point)] : base;
            },
        };
    };

    private readonly getEndPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[3].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => this.parameterNear(point) !== undefined,
            preview: (point: XYZ | undefined) => {
                const base = [
                    this.meshPoint(this.stepDatas[0].point!),
                    this.meshPoint(this.stepDatas[3].point!),
                    this.ellipsePreview(this.stepDatas[2].point)[2],
                ];
                if (!point) return base;

                const full = this.fullEllipse();
                if (!full.isOk) return [...base, this.meshPoint(point)];
                const startParam = this.parameterNear(this.stepDatas[3].point!);
                const endParam = this.parameterNear(point);
                if (startParam === undefined || endParam === undefined)
                    return [...base, this.meshPoint(point)];

                const start = Math.min(startParam, endParam);
                const end = Math.max(startParam, endParam);
                const trimmed = full.value.curve.trim(start, end);
                return [...base, this.meshPoint(point), this.meshShape(shapeFactory.edge(trimmed))];
            },
        };
    };

    protected override geometryNode(): GeometryNode {
        const { normal, center, xvec, majorRadius, minorRadius } = this.ellipseParams();
        const startParameter = this.parameterNear(this.stepDatas[3].point!)!;
        const endParameter = this.parameterNear(this.stepDatas[4].point!)!;
        return new EllipticalArcNode({
            document: this.document,
            normal,
            center,
            xvec,
            majorRadius,
            minorRadius,
            startParameter,
            endParameter,
        });
    }
}
