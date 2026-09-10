// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type AsyncController,
    command,
    type GeometryNode,
    GeometryUtils,
    GetOrSelectShapeStep,
    type IDocument,
    type IEdge,
    type IFace,
    type IShape,
    type IStep,
    type LengthAtAxisSnapData,
    LengthAtAxisStep,
    nonConstructionNodeFilter,
    Precision,
    PubSub,
    Result,
    type ShapeType,
    ShapeTypes,
    type SnapResult,
} from "@chili3d/core";
import { closedProfileToFace, ExtrudeNode } from "../../bodys";
import { FaceNode } from "../../bodys/face";
import { CreateFromSelectionCommand } from "../createCommand";

const SECTION_SHAPE_TYPES = (ShapeTypes.face | ShapeTypes.edge | ShapeTypes.wire) as ShapeType;

/**
 * Extrude's select step, layered over GetOrSelectShapeStep's multi-select so
 * a user can pick several disjoint edges (e.g. 4 separate Line nodes sketched
 * on a face, which have no wire/face relationship to each other) instead of
 * only a single pre-built face/wire. If the picked set can't be joined into
 * one closed profile, the command aborts with a toast explaining why instead
 * of silently extruding just the first edge - the user re-invokes Extrude
 * with a corrected selection. (A pick-again loop isn't used here: the
 * AsyncController passed to a step is single-use - GetOrSelectShapeStep's
 * already-selected fast path resolves it immediately, so calling this step's
 * underlying picker a second time on the same controller would be a no-op.)
 */
class SelectExtrudeSectionStep extends GetOrSelectShapeStep {
    constructor(private readonly command: ExtrudeCommand) {
        super(SECTION_SHAPE_TYPES, "prompt.select.shape", {
            multiple: true,
            nodeFilter: nonConstructionNodeFilter,
        });
    }

    override async execute(
        document: IDocument,
        controller: AsyncController,
    ): Promise<SnapResult | undefined> {
        const result = await super.execute(document, controller);
        if (!result || result.shapes.length <= 1) return result;

        const section = this.command.buildSection(result, false);
        if (section.isOk) {
            section.value.dispose();
            return result;
        }

        PubSub.default.pub("showToast", "error.default:{0}", section.error);
        return undefined;
    }
}

@command({
    key: "create.extrude",
    icon: "icon-prism",
})
export class ExtrudeCommand extends CreateFromSelectionCommand {
    protected override geometryNode(): GeometryNode {
        const shape = this.buildSection(this.stepDatas[0], false).value;
        const { point, normal } = this.getAxis(shape);
        const dist = this.stepDatas[1].point!.sub(point).dot(normal);
        return new ExtrudeNode({ document: this.document, section: shape, length: dist });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectExtrudeSectionStep(this),
            new LengthAtAxisStep("prompt.pickNextPoint", this.getLengthStepData, true),
        ];
    }

    /**
     * Resolves a select step's picks into a single extrusion profile. A
     * single pick is used as-is (a face, a wire, or an edge - including a
     * closed one like a circle). Multiple picks must all be edges/wires that
     * join end-to-end into one closed loop; FaceNode already does that
     * joining (with an endpoint tolerance), so it's reused here rather than
     * duplicating the logic.
     */
    buildSection(step: SnapResult, shouldDispose: boolean): Result<IShape> {
        if (step.shapes.length === 1) {
            return Result.ok(this.transformdFirstShape(step, shouldDispose));
        }

        const shapes = this.transformdShapes(step, false);
        if (shapes.some((s) => s.shapeType === ShapeTypes.face)) {
            shapes.forEach((s) => s.dispose());
            return Result.err("Select a single face, or edges/wires that together form a closed profile");
        }

        let face: Result<IShape>;
        try {
            face = new FaceNode({ document: this.document, shapes: shapes as IEdge[] }).generateShape();
        } catch (e) {
            face = Result.err(e instanceof Error ? e.message : String(e));
        }
        shapes.forEach((s) => s.dispose());
        if (face.isOk && shouldDispose) {
            this.disposeStack.add(face.value);
        }
        return face;
    }

    private readonly getLengthStepData = (): LengthAtAxisSnapData => {
        const shape = this.buildSection(this.stepDatas[0], true).value;
        const { point, normal } = this.getAxis(shape);
        return {
            point,
            direction: normal,
            preview: (p) => {
                if (!p) return [];
                const dist = p.sub(point).dot(normal);
                if (Math.abs(dist) < Precision.Float) return [];
                const vec = normal.multiply(dist);
                if (shape.shapeType === ShapeTypes.face) {
                    const sur = (shape as IFace).surface();
                    if (!sur.isPlanar()) {
                        return [this.meshCreatedShape("makeThickSolidBySimple", shape, dist)];
                    }
                } else if (
                    (shape.shapeType === ShapeTypes.wire || shape.shapeType === ShapeTypes.edge) &&
                    shape.isClosed()
                ) {
                    const face = closedProfileToFace(shape);
                    if (face.isOk) {
                        return [this.meshCreatedShape("prism", face.value, vec)];
                    }
                }
                return [this.meshCreatedShape("prism", shape, vec)];
            },
        };
    };

    private getAxis(shape: IShape) {
        const point = this.stepDatas[0].shapes[0].point!;
        const normal = GeometryUtils.normal(shape as any);
        return { point, normal };
    }
}
