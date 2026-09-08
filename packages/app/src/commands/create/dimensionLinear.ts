// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    DimensionAnnotation,
    type DimensionEditHandler,
    Dimensions,
    type IStep,
    MultistepCommand,
    type PointSnapData,
    PointStep,
    Precision,
    setDimensionEditHandler,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { LineNode } from "../../bodys";

/**
 * Creates an editable linear dimension between two picked points. When both
 * points land on the same LineNode's endpoints, double-clicking the
 * dimension's label later can edit that line's length; any other pair of
 * points still gets a dimension, just a read-only one - measuring across
 * unrelated shapes has no single property to write an edited value back to.
 */
@command({
    key: "create.dimensionLinear",
    icon: "icon-measureLength",
})
export class LinearDimension extends MultistepCommand {
    protected override executeMainTask(): void {
        const start = this.stepDatas[0].point!;
        const end = this.stepDatas[1].point!;
        const placement = this.stepDatas[2].point!;

        Transaction.execute(this.document, "create dimension", () => {
            const annotation = new DimensionAnnotation({
                document: this.document,
                name: "Dimension",
                annotationType: "dimension",
                dimensionType: "linear",
                startPoint: start,
                endPoint: end,
                placement,
            });
            this.document.modelManager.addNode(annotation);

            const handler = this.buildEditHandler(annotation, start, end);
            if (handler) setDimensionEditHandler(annotation, handler);

            this.document.visual.update();
        });
        this.repeatOperation = true;
    }

    private buildEditHandler(
        annotation: DimensionAnnotation,
        start: XYZ,
        end: XYZ,
    ): DimensionEditHandler | undefined {
        const ownerA = this.stepDatas[0].shapes[0]?.owner.node;
        const ownerB = this.stepDatas[1].shapes[0]?.owner.node;
        if (!ownerA || ownerA !== ownerB || !(ownerA instanceof LineNode)) return undefined;

        const line = ownerA;
        const startIsLineStart = start.distanceTo(line.start) < Precision.Distance;
        const startIsLineEnd = start.distanceTo(line.end) < Precision.Distance;
        const endIsLineStart = end.distanceTo(line.start) < Precision.Distance;
        const endIsLineEnd = end.distanceTo(line.end) < Precision.Distance;
        if (!((startIsLineStart && endIsLineEnd) || (startIsLineEnd && endIsLineStart))) return undefined;

        const movingIsEnd = startIsLineStart;
        return (newLength: number) => {
            if (newLength <= Precision.Distance) return false;
            const pinned = movingIsEnd ? line.start : line.end;
            const moving = movingIsEnd ? line.end : line.start;
            const direction = moving.sub(pinned).normalize();
            if (!direction) return false;
            const newPoint = pinned.add(direction.multiply(newLength));
            if (movingIsEnd) line.end = newPoint;
            else line.start = newPoint;

            // Keep the annotation's own points in sync so the rendered
            // extension/dimension lines track the line they measure.
            if (movingIsEnd) annotation.endPoint = newPoint;
            else annotation.startPoint = newPoint;
            return true;
        };
    }

    getSteps(): IStep[] {
        return [
            new PointStep("prompt.pickFistPoint"),
            new PointStep("prompt.pickNextPoint", this.getSecondPointData),
            new PointStep("prompt.pickNextPoint", this.getPlacementData),
        ];
    }

    private readonly getSecondPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[0].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => this.stepDatas[0].point!.distanceTo(point) > Precision.Distance,
            preview: this.segmentPreview,
        };
    };

    private readonly getPlacementData = (): PointSnapData => {
        return {
            dimension: Dimensions.D1D2D3,
            preview: this.placementPreview,
        };
    };

    private readonly segmentPreview = (point: XYZ | undefined) => {
        if (!point) return [this.meshPoint(this.stepDatas[0].point!)];
        return [this.meshPoint(this.stepDatas[0].point!), this.meshLine(this.stepDatas[0].point!, point)];
    };

    private readonly placementPreview = (point: XYZ | undefined) => {
        const start = this.stepDatas[0].point!;
        const end = this.stepDatas[1].point!;
        const lines = [this.meshLine(start, end)];
        if (point) lines.push(this.meshLine(end, point));
        return lines;
    };
}
