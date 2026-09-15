// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { VisualConfig } from "../config";
import type { IDocument } from "../document";
import type { AsyncController } from "../foundation";
import type { INodeFilter, IShapeFilter } from "../selectionFilter";
import { type IShape, MeshDataUtils, type ShapeType, ShapeTypeUtils } from "../shape";
import { type IView, type VisualShapeData, type VisualState, VisualStates } from "../visual";
import { SelectionHandler } from "./selectionEventHandler";

export abstract class ShapeSelectionHandler extends SelectionHandler {
    protected _highlights: VisualShapeData[] | undefined;
    private _detectAtMouse: VisualShapeData[] | undefined;
    private _lockDetected: IShape | undefined;
    /** Id of the bright hover marker shown over the nearest candidate vertex
     * while this handler is picking `ShapeTypes.vertex` (see
     * `showHoverVertex`/`hideHoverVertex`) - `undefined` when none is
     * displayed, or for any handler not picking vertices at all. */
    private _hoverVertexMeshId: number | undefined;

    highlightState: VisualState = VisualStates.edgeHighlight;

    /** In multi mode, finish the pick automatically once this returns true. */
    canFinish?: (selected: VisualShapeData[]) => boolean;

    constructor(
        document: IDocument,
        readonly shapeType: ShapeType,
        multiMode: boolean,
        controller?: AsyncController,
        readonly shapefilter?: IShapeFilter,
        readonly nodeFilter?: INodeFilter,
    ) {
        super(document, multiMode, controller);
    }

    private getDetecteds(view: IView, event: PointerEvent) {
        if (
            this.rect &&
            Math.abs(this.mouse.x - event.offsetX) > 3 &&
            Math.abs(this.mouse.y - event.offsetY) > 3
        ) {
            return view.detectShapesRect(
                this.shapeType,
                this.mouse.x,
                this.mouse.y,
                event.offsetX,
                event.offsetY,
                this.shapefilter,
                this.nodeFilter,
            );
        }
        this._detectAtMouse = view.detectShapes(
            this.shapeType,
            event.offsetX,
            event.offsetY,
            this.shapefilter,
            this.nodeFilter,
        );
        const detected = this.getDetecting();
        return detected ? [detected] : [];
    }

    override pointerMove(view: IView, event: PointerEvent): void {
        super.pointerMove(view, event);
        this._lockDetected = undefined;
    }

    protected override setHighlight(view: IView, event: PointerEvent) {
        const detecteds = this.getDetecteds(view, event);
        this.highlightDetecteds(view, detecteds);
    }

    protected highlightDetecteds(view: IView, detecteds: VisualShapeData[]) {
        this.cleanHighlights();
        detecteds.forEach((x) => {
            this.document.visual.highlighter.addState(
                x.owner,
                this.highlightState,
                x.shape.shapeType,
                ...x.indexes,
            );
        });
        this._highlights = detecteds;
        this.showHoverVertex(detecteds);
        view.update();
    }

    /** Renders a bright, unmissable marker over the nearest detected vertex
     * while this handler is picking `ShapeTypes.vertex` - the shared
     * highlighter's own vertex state recolors an entity's *entire* points
     * buffer (see `GeometryState`/`ShapeTypeUtils.isWhole`, which treats
     * `ShapeTypes.vertex` as a whole-object state, not a per-point one), so
     * on a two-point line both endpoints light up together and a click
     * still looks ambiguous. This draws one marker at the exact picked
     * point instead, the same "big dot" mechanism `ObjectSnap.displayHint`
     * already uses while drawing - additive only, so it can't change what a
     * click actually selects (edges are already excluded from the
     * candidate set for a vertex-only pick, see `subShapeVisual`). */
    private showHoverVertex(detecteds: VisualShapeData[]) {
        if (!ShapeTypeUtils.hasVertex(this.shapeType)) return;
        const point = detecteds[0]?.point;
        if (!point) return;
        const data = MeshDataUtils.createVertexMesh(
            point,
            VisualConfig.hoverVertexSize,
            VisualConfig.hoverVertexColor,
        );
        this._hoverVertexMeshId = this.document.visual.context.displayMesh([data]);
    }

    private hideHoverVertex() {
        if (this._hoverVertexMeshId === undefined) return;
        this.document.visual.context.removeMesh(this._hoverVertexMeshId);
        this._hoverVertexMeshId = undefined;
    }

    protected cleanHighlights() {
        this._highlights?.forEach((x) => {
            this.document.visual.highlighter.removeState(
                x.owner,
                this.highlightState,
                x.shape.shapeType,
                ...x.indexes,
            );
        });
        this._highlights = undefined;
        this.hideHoverVertex();
    }

    protected highlightNext(view: IView) {
        if (this._detectAtMouse && this._detectAtMouse.length > 1) {
            const index = this._lockDetected
                ? (this.getDetcedtingIndex() + 1) % this._detectAtMouse.length
                : 1;
            this._lockDetected = this._detectAtMouse[index].shape;
            const detected = this.getDetecting();
            if (detected) this.highlightDetecteds(view, [detected]);
        }
    }

    protected override canFinishSelection(): boolean {
        return this.canFinish?.(this.document.selection.getSelectedShapes()) ?? false;
    }

    private getDetecting() {
        if (this._detectAtMouse) {
            const index = this._lockDetected ? this.getDetcedtingIndex() : 0;
            return this._detectAtMouse[index];
        }
        return undefined;
    }

    private getDetcedtingIndex() {
        return this._detectAtMouse?.findIndex((x) => this._lockDetected === x.shape) ?? -1;
    }
}

export class SubshapeSelectionHandler extends ShapeSelectionHandler {
    selectedState: VisualState = VisualStates.edgeSelected;

    protected override select(view: IView, event: PointerEvent): number {
        if (!this._highlights?.length) {
            return 0;
        }

        return this.document.selection.setSelectedShapes(
            this._highlights,
            this.selectedState,
            this.multiMode,
        );
    }
}
