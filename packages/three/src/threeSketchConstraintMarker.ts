// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type BoundingBox,
    type INode,
    type IVisualObject,
    isPropertyChanged,
    isSketchPointOwner,
    Matrix4,
    NodeUtils,
    type SketchConstraintNode,
    SketchGroupNode,
} from "@chili3d/core";
import { Object3D } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { IHighlightable } from "./highlightable";
import { ThreeHelper } from "./threeHelper";
import type { ThreeVisualContext } from "./threeVisualContext";

const BADGE_TEXT: Record<string, string> = {
    coincident: "≡",
    horizontal: "H",
    vertical: "V",
    parallel: "∥",
    perpendicular: "⊥",
    equal: "=",
};

/**
 * A small on-canvas badge showing that a `SketchConstraintNode` exists and
 * where - purely a CSS2D label (like `ThreeDimensionAnnotation`'s value
 * label), not a 3D mesh, since there's nothing to draw a line/shape for.
 * Not raycast-pickable (a CSS2D object never is - `ThreeView`'s whole-node
 * picking only reaches annotation types it explicitly branches on, and a
 * label-only object was never going to be among them); clicking the badge
 * itself selects the node directly via `document.selection`, the same way
 * `ThreeDimensionAnnotation`'s label is only interactive through its own
 * DOM handlers, not 3D picking. Once selected, the existing Delete key /
 * right-click "Delete" in the Items tree removes it like any other node -
 * no bespoke deletion path needed here.
 */
export class ThreeSketchConstraintMarker extends Object3D implements IVisualObject, IHighlightable {
    locked = false;
    transform: Matrix4 = Matrix4.identity();
    private readonly _labelEl: HTMLDivElement;
    private readonly _label: CSS2DObject;
    private readonly _listenedOwners: INode[] = [];

    constructor(
        private readonly context: ThreeVisualContext,
        readonly node: SketchConstraintNode,
    ) {
        super();
        this._labelEl = this.buildLabelElement();
        this._label = new CSS2DObject(this._labelEl);
        this.add(this._label);
        this.subscribeToOwners();
        this.refreshPosition();
    }

    highlight(): void {
        this._labelEl.style.outline = "2px solid #00ffff";
    }

    unhighlight(): void {
        this._labelEl.style.outline = "none";
    }

    boundingBox(): BoundingBox | undefined {
        return undefined;
    }

    worldTransform(): Matrix4 {
        return Matrix4.identity();
    }

    dispose(): void {
        this._listenedOwners.forEach((owner) => owner.removePropertyChanged(this.handleOwnerChanged));
        this._listenedOwners.length = 0;
        this._labelEl.remove();
    }

    private readonly handleOwnerChanged = () => {
        this.refreshPosition();
        this.context.visual.update();
    };

    /** Refreshes the badge's position whenever any point-owning node the
     * constraint references changes - a constraint's own properties never
     * change after creation, but the points it references do (a re-solve,
     * or - once drag-to-edit exists - a direct drag). */
    private subscribeToOwners() {
        const sketch = this.node.parent;
        if (!(sketch instanceof SketchGroupNode)) return;

        const seen = new Set<string>();
        for (const handle of this.node.constraint.handles()) {
            if (seen.has(handle.nodeId)) continue;
            seen.add(handle.nodeId);

            // Every INode already implements IPropertyChanged, so this is
            // just a defensive narrowing, not a "which node types support
            // this" check - true for anything findNode could ever return.
            const owner = NodeUtils.findNode(sketch, (n) => n.id === handle.nodeId);
            if (owner && isPropertyChanged(owner)) {
                owner.onPropertyChanged(this.handleOwnerChanged);
                this._listenedOwners.push(owner);
            }
        }
    }

    private refreshPosition() {
        const point = this.markerPosition();
        if (point) this._label.position.copy(ThreeHelper.fromXYZ(point));
    }

    private markerPosition() {
        const sketch = this.node.parent;
        if (!(sketch instanceof SketchGroupNode)) return undefined;

        const handle = this.node.constraint.handles()[0];
        if (!handle) return undefined;

        const owner = NodeUtils.findNode(sketch, (n) => n.id === handle.nodeId);
        if (!owner || !isSketchPointOwner(owner)) return undefined;

        return owner.getSketchPoint(handle.role);
    }

    private buildLabelElement(): HTMLDivElement {
        const el = document.createElement("div");
        el.textContent = BADGE_TEXT[this.node.constraint.kind] ?? "?";
        el.title = this.node.name;
        el.style.background = "rgba(30, 100, 200, 0.85)";
        el.style.color = "#fff";
        el.style.padding = "1px 6px";
        el.style.borderRadius = "3px";
        el.style.fontSize = "11px";
        el.style.fontFamily = "arial";
        el.style.fontWeight = "bold";
        el.style.lineHeight = "1.4";
        el.style.whiteSpace = "nowrap";
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.style.userSelect = "none";
        el.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            this.context.visual.document.selection.setSelectedNodes([this.node], false);
            this.context.visual.update();
        });
        return el;
    }
}
