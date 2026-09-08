// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type BoundingBox,
    computeLinearDimensionGeometry,
    computeRadialDimensionGeometry,
    type DimensionAnnotation,
    getDimensionEditHandler,
    type IVisualObject,
    Matrix4,
    type XYZ,
} from "@chili3d/core";
import { DoubleSide, type Mesh, Object3D, type Points } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Constants } from "./constants";
import type { IHighlightable } from "./highlightable";
import { ThreeHelper } from "./threeHelper";
import type { ThreeVisualContext } from "./threeVisualContext";

const ARROW_LENGTH = 3;
const ARROW_WIDTH = 1.1;

const material = new LineMaterial({ linewidth: 1.5, color: 0x2f8fef, side: DoubleSide });
const highlightMaterial = new LineMaterial({ linewidth: 1.5, color: 0x00ffff, side: DoubleSide });

function formatValue(value: number): string {
    return `${value.toFixed(2)} mm`;
}

export class ThreeDimensionAnnotation extends Object3D implements IVisualObject, IHighlightable {
    locked = false;
    transform: Matrix4 = Matrix4.identity();
    private _mesh: LineSegments2;
    private readonly _labelEl: HTMLDivElement;
    private readonly _label: CSS2DObject;
    private readonly _valueEl: HTMLSpanElement;

    constructor(
        private readonly context: ThreeVisualContext,
        readonly annotation: DimensionAnnotation,
    ) {
        super();
        this._mesh = this.buildLines();
        this.add(this._mesh);

        this._valueEl = document.createElement("span");
        this._labelEl = this.buildLabelElement(this._valueEl);
        this._label = new CSS2DObject(this._labelEl);
        this.add(this._label);
        this.updateLabelText();
        this.positionLabel();

        annotation.onPropertyChanged(this.handlePropertyChanged);
    }

    highlight(): void {
        this._mesh.material = highlightMaterial;
    }

    unhighlight(): void {
        this._mesh.material = material;
    }

    wholeVisual(): (Mesh | LineSegments2 | Points)[] {
        return [this._mesh];
    }

    boundingBox(): BoundingBox | undefined {
        return ThreeHelper.getBoundingBox(this);
    }

    worldTransform(): Matrix4 {
        return Matrix4.identity();
    }

    dispose(): void {
        this.annotation.removePropertyChanged(this.handlePropertyChanged);
        this._mesh.geometry?.dispose();
        this._labelEl.remove();
    }

    private readonly handlePropertyChanged = () => {
        this.remove(this._mesh);
        this._mesh.geometry?.dispose();
        this._mesh = this.buildLines();
        this.add(this._mesh);
        this.updateLabelText();
        this.positionLabel();
    };

    private geometryData() {
        const a = this.annotation;
        if (a.dimensionType === "radial" || a.dimensionType === "diameter") {
            return {
                kind: "radial" as const,
                g: computeRadialDimensionGeometry(a.startPoint, a.endPoint, a.placement, a.dimensionType),
            };
        }
        return {
            kind: "linear" as const,
            g: computeLinearDimensionGeometry(a.startPoint, a.endPoint, a.placement),
        };
    }

    private buildLines(): LineSegments2 {
        const points: number[] = [];
        const pushSeg = (a: XYZ, b: XYZ) => points.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const pushArrow = (tip: XYZ, shaftDir: XYZ, perp: XYZ) => {
            const back = tip.add(shaftDir.multiply(ARROW_LENGTH));
            pushSeg(tip, back.add(perp.multiply(ARROW_WIDTH)));
            pushSeg(tip, back.add(perp.multiply(-ARROW_WIDTH)));
        };

        const data = this.geometryData();
        if (data.kind === "linear") {
            const { extension1, extension2, dimensionLine, direction, perp } = data.g;
            pushSeg(extension1[0], extension1[1]);
            pushSeg(extension2[0], extension2[1]);
            pushSeg(dimensionLine[0], dimensionLine[1]);
            pushArrow(dimensionLine[0], direction, perp);
            pushArrow(dimensionLine[1], direction.reverse(), perp);
        } else {
            const { line, direction, perp } = data.g;
            pushSeg(line[0], line[1]);
            pushArrow(line[1], direction.reverse(), perp);
        }

        const buff = new LineSegmentsGeometry();
        buff.setPositions(points);
        buff.computeBoundingBox();
        const line = new LineSegments2(buff, material);
        line.layers.set(Constants.Layers.Wireframe);
        return line;
    }

    private displayValue(): number {
        return this.annotation.value ?? this.geometryData().g.value;
    }

    private positionLabel() {
        const p = this.geometryData().g.labelPosition;
        this._label.position.copy(ThreeHelper.fromXYZ(p));
    }

    private updateLabelText() {
        this._valueEl.textContent = formatValue(this.displayValue());
    }

    private buildLabelElement(valueEl: HTMLSpanElement): HTMLDivElement {
        // The app's global stylesheet sets `color` directly on bare `span`/
        // `button` elements, which - unlike inheritance - overrides whatever
        // color the parent has, inline style or not. Every text-bearing child
        // needs its own explicit color, not just this wrapper.
        valueEl.style.color = "#fff";

        const el = document.createElement("div");
        el.style.background = "rgba(30, 30, 30, 0.85)";
        el.style.color = "#fff";
        el.style.padding = "2px 8px";
        el.style.borderRadius = "4px";
        el.style.fontSize = "12px";
        el.style.fontFamily = "arial";
        el.style.whiteSpace = "nowrap";
        el.style.pointerEvents = "auto";
        el.style.cursor = "default";
        el.style.userSelect = "none";
        el.append(valueEl);
        el.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            this.beginEdit();
        });
        return el;
    }

    private beginEdit() {
        const handler = getDimensionEditHandler(this.annotation);
        if (!handler) return;

        this._labelEl.textContent = "";
        const input = document.createElement("input");
        input.type = "text";
        input.value = this.displayValue().toFixed(4);
        input.style.width = "70px";
        input.style.background = "#0f2a3f";
        input.style.color = "#4fd1ff";
        input.style.border = "1px solid #4fd1ff";
        input.style.borderRadius = "3px";
        input.style.font = "inherit";
        input.style.padding = "1px 4px";
        input.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
        });
        input.addEventListener("pointerdown", (e) => e.stopPropagation());

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "✓";
        confirmBtn.style.marginLeft = "4px";
        confirmBtn.style.cursor = "pointer";
        confirmBtn.onclick = (e) => {
            e.stopPropagation();
            commit();
        };

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "✕";
        cancelBtn.style.marginLeft = "2px";
        cancelBtn.style.cursor = "pointer";
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            cancel();
        };

        const commit = () => {
            const value = Number.parseFloat(input.value);
            if (Number.isFinite(value) && value > 0 && handler(value)) {
                this.endEdit();
                // Rendering is on-demand (threeView.ts's `_needsUpdate` flag) -
                // the measured shape's mesh already rebuilt reactively via its
                // own onPropertyChanged handler, but nothing repaints the
                // canvas until something schedules a frame.
                this.context.visual.update();
            } else {
                cancel();
            }
        };
        const cancel = () => this.endEdit();

        this._labelEl.append(input, confirmBtn, cancelBtn);
        input.focus();
        input.select();
    }

    private endEdit() {
        this._labelEl.textContent = "";
        this._labelEl.append(this._valueEl);
        this.updateLabelText();
    }
}
