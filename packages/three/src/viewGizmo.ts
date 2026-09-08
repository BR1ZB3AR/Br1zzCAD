// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IViewGizmo, XYZ } from "@chili3d/core";
import { Matrix4, Vector3 } from "three";
import type { CameraController } from "./cameraController";
import type { ThreeView } from "./threeView";

const MOUSE_LEFT = 1;

const options = {
    size: 240,
    cubeScale: 70,
    lineWidth: 1.25,
    fontSize: "12px",
    fontFamily: "arial",
    faceColor: "#e4e4e4",
    hoverColor: "#4a9eff",
    edgeColor: "#333333",
    labelColor: "#151515",
    hoverLabelColor: "#ffffff",
};

/** A chamfer inset (0-1): how far each face shrinks toward its center to
 * make room for the edge/corner facets. 0 = sharp cube, closer to 1 = more
 * chamfered/rounded-looking. */
const CHAMFER = 0.62;

export type CubePartKind = "face" | "edge" | "corner";

/** One clickable facet of the nav cube: a face, an edge bevel (between two
 * adjacent faces), or a corner bevel (between three). `direction` is the
 * world-space (Z-up) direction the camera snaps to when it's clicked. */
export interface CubePart {
    kind: CubePartKind;
    label: string;
    direction: Vector3;
    corners: Vector3[];
}

interface ProjectedPart {
    part: CubePart;
    points: Vector3[];
    depth: number;
}

function v(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z);
}

function part(kind: CubePartKind, label: string, direction: Vector3, corners: Vector3[]): CubePart {
    return { kind, label, direction: direction.normalize(), corners };
}

const S = CHAMFER;

export const FACES: CubePart[] = [
    part("face", "TOP", v(0, 0, 1), [v(-S, -S, 1), v(S, -S, 1), v(S, S, 1), v(-S, S, 1)]),
    part("face", "BOTTOM", v(0, 0, -1), [v(-S, -S, -1), v(-S, S, -1), v(S, S, -1), v(S, -S, -1)]),
    part("face", "FRONT", v(0, -1, 0), [v(-S, -1, -S), v(S, -1, -S), v(S, -1, S), v(-S, -1, S)]),
    part("face", "BACK", v(0, 1, 0), [v(S, 1, -S), v(-S, 1, -S), v(-S, 1, S), v(S, 1, S)]),
    part("face", "RIGHT", v(1, 0, 0), [v(1, -S, -S), v(1, S, -S), v(1, S, S), v(1, -S, S)]),
    part("face", "LEFT", v(-1, 0, 0), [v(-1, S, -S), v(-1, -S, -S), v(-1, -S, S), v(-1, S, S)]),
];

export const EDGES: CubePart[] = [
    part("edge", "", v(0, -1, 1), [v(-S, -S, 1), v(S, -S, 1), v(S, -1, S), v(-S, -1, S)]),
    part("edge", "", v(0, 1, 1), [v(S, S, 1), v(-S, S, 1), v(-S, 1, S), v(S, 1, S)]),
    part("edge", "", v(1, 0, 1), [v(S, -S, 1), v(S, S, 1), v(1, S, S), v(1, -S, S)]),
    part("edge", "", v(-1, 0, 1), [v(-S, S, 1), v(-S, -S, 1), v(-1, -S, S), v(-1, S, S)]),
    part("edge", "", v(0, -1, -1), [v(S, -S, -1), v(-S, -S, -1), v(-S, -1, -S), v(S, -1, -S)]),
    part("edge", "", v(0, 1, -1), [v(-S, S, -1), v(S, S, -1), v(S, 1, -S), v(-S, 1, -S)]),
    part("edge", "", v(1, 0, -1), [v(S, S, -1), v(S, -S, -1), v(1, -S, -S), v(1, S, -S)]),
    part("edge", "", v(-1, 0, -1), [v(-S, -S, -1), v(-S, S, -1), v(-1, S, -S), v(-1, -S, -S)]),
    part("edge", "", v(1, -1, 0), [v(S, -1, -S), v(S, -1, S), v(1, -S, S), v(1, -S, -S)]),
    part("edge", "", v(-1, -1, 0), [v(-S, -1, S), v(-S, -1, -S), v(-1, -S, -S), v(-1, -S, S)]),
    part("edge", "", v(1, 1, 0), [v(S, 1, S), v(S, 1, -S), v(1, S, -S), v(1, S, S)]),
    part("edge", "", v(-1, 1, 0), [v(-S, 1, -S), v(-S, 1, S), v(-1, S, S), v(-1, S, -S)]),
];

export const CORNERS: CubePart[] = [
    part("corner", "", v(1, 1, 1), [v(S, S, 1), v(S, 1, S), v(1, S, S)]),
    part("corner", "", v(1, 1, -1), [v(S, S, -1), v(1, S, -S), v(S, 1, -S)]),
    part("corner", "", v(1, -1, 1), [v(S, -S, 1), v(S, -1, S), v(1, -S, S)]),
    part("corner", "", v(1, -1, -1), [v(S, -S, -1), v(1, -S, -S), v(S, -1, -S)]),
    part("corner", "", v(-1, 1, 1), [v(-S, S, 1), v(-1, S, S), v(-S, 1, S)]),
    part("corner", "", v(-1, 1, -1), [v(-S, S, -1), v(-S, 1, -S), v(-1, S, -S)]),
    part("corner", "", v(-1, -1, 1), [v(-S, -S, 1), v(-1, -S, S), v(-S, -1, S)]),
    part("corner", "", v(-1, -1, -1), [v(-S, -S, -1), v(-S, -1, -S), v(-1, -S, -S)]),
];

const ALL_PARTS: CubePart[] = [...FACES, ...EDGES, ...CORNERS];

export class ViewGizmo extends HTMLElement implements IViewGizmo {
    private readonly _center: Vector3;
    private readonly _canvas: HTMLCanvasElement;
    private readonly _context: CanvasRenderingContext2D;
    readonly cameraController: CameraController;
    private _canClick: boolean = true;
    private _hoverPart?: CubePart;
    private _visibleParts: ProjectedPart[] = [];
    private _mouse?: Vector3;

    constructor(readonly view: ThreeView) {
        super();
        this.cameraController = view.cameraController;
        this._center = new Vector3(options.size * 0.5, options.size * 0.5, 0);
        this._canvas = this._initCanvas();
        this._context = this._canvas.getContext("2d")!;
        this._initStyle();
    }
    setDom(dom: HTMLElement): void {
        this.remove();
        dom.appendChild(this);
    }

    dispose(): void {
        this.remove();
    }

    private _initStyle() {
        this.style.zIndex = "999";
        this.style.position = "absolute";
        this.style.top = "20px";
        this.style.right = "20px";
        this.style.cursor = "pointer";
        this.style.userSelect = "none";
        this.style.webkitUserSelect = "none";
    }

    private _initCanvas() {
        const canvas = document.createElement("canvas");
        canvas.width = options.size;
        canvas.height = options.size;
        canvas.style.width = `${options.size * 0.5}px`;
        canvas.style.height = `${options.size * 0.5}px`;
        this.append(canvas);
        return canvas;
    }

    connectedCallback() {
        this._canvas.addEventListener("pointermove", this._onPointerMove);
        this._canvas.addEventListener("pointerout", this._onPointerOut);
        this._canvas.addEventListener("click", this._onClick);
        this._canvas.addEventListener("pointerdown", this._onPointerDown);
        this._canvas.addEventListener("pointerup", this._onPointerUp);
    }

    disconnectedCallback() {
        this._canvas.removeEventListener("pointermove", this._onPointerMove);
        this._canvas.removeEventListener("pointerout", this._onPointerOut);
        this._canvas.removeEventListener("click", this._onClick);
        this._canvas.removeEventListener("pointerdown", this._onPointerDown);
        this._canvas.removeEventListener("pointerup", this._onPointerUp);
    }

    private readonly _onPointerMove = (e: PointerEvent) => {
        e.stopPropagation();
        if (e.buttons === MOUSE_LEFT && !(e.movementX === 0 && e.movementY === 0)) {
            this.cameraController.rotate(e.movementX * 4, e.movementY * 4);
            this._canClick = false;
        }
        const rect = this._canvas.getBoundingClientRect();
        this._mouse = new Vector3(e.clientX - rect.left, e.clientY - rect.top, 0).multiplyScalar(2);
        this.view.update();
    };

    private readonly _onPointerDown = (e: PointerEvent) => {
        e.stopPropagation();
        this._canvas.setPointerCapture(e.pointerId);
        this.cameraController.setRotateCenterToSelected();
    };

    private readonly _onPointerUp = (e: PointerEvent) => {
        e.stopPropagation();
        this._canvas.releasePointerCapture(e.pointerId);
    };

    private readonly _onPointerOut = (e: PointerEvent) => {
        e.stopPropagation();
        this._mouse = undefined;
        this._hoverPart = undefined;
    };

    private readonly _onClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (!this._canClick) {
            this._canClick = true;
            return;
        }
        if (this._hoverPart) {
            const direction = this._hoverPart.direction;
            const distance = this.cameraController.camera.position.distanceTo(this.cameraController.target);
            const position = direction.clone().multiplyScalar(distance).add(this.cameraController.target);
            this.cameraController.camera.position.copy(position);
            // A direction that's purely +-Z is parallel to the default up
            // vector, which degenerates lookAt - swap to a +-Y up for those.
            let up = new XYZ({ x: 0, y: 0, z: 1 });
            if (direction.x === 0 && direction.y === 0) {
                up = direction.z > 0 ? new XYZ({ x: 0, y: 1, z: 0 }) : new XYZ({ x: 0, y: -1, z: 0 });
            }
            this.cameraController.lookAt(
                this.cameraController.camera.position,
                this.cameraController.target,
                up,
            );
            this.view.update();
        }
    };

    clear() {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }

    update() {
        this.clear();
        const invRotMat = new Matrix4().makeRotationFromEuler(this.cameraController.camera.rotation).invert();
        this._visibleParts = this._project(invRotMat);
        this._hoverPart = this._hitTest(this._visibleParts);
        this._draw(this._visibleParts);
    }

    private _project(invRotMat: Matrix4): ProjectedPart[] {
        const projected: ProjectedPart[] = [];
        for (const p of ALL_PARTS) {
            const normal = p.direction.clone().applyMatrix4(invRotMat);
            if (normal.z < -0.01) continue;

            let depth = 0;
            const points = p.corners.map((corner) => {
                const rotated = corner.clone().applyMatrix4(invRotMat);
                depth += rotated.z;
                return this.getBubblePosition(rotated);
            });
            projected.push({ part: p, points, depth: depth / p.corners.length });
        }
        // Painter's algorithm: farthest (smallest depth) first, so nearer
        // parts draw on top and correctly occlude it.
        projected.sort((a, b) => a.depth - b.depth);
        return projected;
    }

    private _hitTest(parts: ProjectedPart[]): CubePart | undefined {
        if (!this._mouse || !this._canClick) return undefined;
        for (let i = parts.length - 1; i >= 0; i--) {
            if (this.pointInPolygon(this._mouse, parts[i].points)) return parts[i].part;
        }
        return undefined;
    }

    private pointInPolygon(point: Vector3, corners: Vector3[]): boolean {
        let inside = false;
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
            const a = corners[i];
            const b = corners[j];
            const crosses =
                a.y > point.y !== b.y > point.y &&
                point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
            if (crosses) inside = !inside;
        }
        return inside;
    }

    private _draw(parts: ProjectedPart[]) {
        for (const projected of parts) {
            const isHovered = projected.part === this._hoverPart;
            this.drawPart(projected.points, isHovered);
            if (projected.part.label) this.drawLabel(projected, isHovered);
        }
    }

    private drawPart(points: Vector3[], isHovered: boolean) {
        this._context.beginPath();
        this._context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this._context.lineTo(points[i].x, points[i].y);
        }
        this._context.closePath();
        this._context.fillStyle = isHovered ? options.hoverColor : options.faceColor;
        this._context.fill();
        this._context.lineWidth = options.lineWidth;
        this._context.strokeStyle = options.edgeColor;
        this._context.stroke();
    }

    private drawLabel(projected: ProjectedPart, isHovered: boolean) {
        const cx = projected.points.reduce((sum, p) => sum + p.x, 0) / projected.points.length;
        const cy = projected.points.reduce((sum, p) => sum + p.y, 0) / projected.points.length;
        this._context.font = [options.fontSize, options.fontFamily].join(" ");
        this._context.fillStyle = isHovered ? options.hoverLabelColor : options.labelColor;
        this._context.textBaseline = "middle";
        this._context.textAlign = "center";
        this._context.fillText(projected.part.label, cx, cy);
    }

    private getBubblePosition(vector: Vector3) {
        return new Vector3(
            vector.x * options.cubeScale + this._center.x,
            this._center.y - vector.y * options.cubeScale,
            vector.z,
        );
    }
}

customElements.define("view-gizmo", ViewGizmo);
