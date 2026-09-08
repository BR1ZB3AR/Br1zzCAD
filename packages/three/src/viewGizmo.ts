// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IViewGizmo, XYZ } from "@chili3d/core";
import { Matrix4, Vector3 } from "three";
import type { CameraController } from "./cameraController";
import type { ThreeView } from "./threeView";

const MOUSE_LEFT = 1;

const options = {
    size: 220,
    cubeScale: 52,
    lineWidth: 1.5,
    fontSize: "12px",
    fontFamily: "arial",
    faceColor: "#8a8a8a",
    faceColorHover: "#b8b8b8",
    edgeColor: "#2b2b2b",
    labelColor: "#151515",
};

/** A face of the nav cube: the direction it points (in world space, Z-up)
 * and the four corners (unit cube, world space) that make up its quad. */
export interface CubeFace {
    label: string;
    direction: Vector3;
    corners: Vector3[];
}

interface ProjectedFace {
    face: CubeFace;
    points: Vector3[];
    depth: number;
}

function face(label: string, direction: [number, number, number], corners: [number, number, number][]) {
    return {
        label,
        direction: new Vector3(...direction),
        corners: corners.map((c) => new Vector3(...c)),
    };
}

export const FACES: CubeFace[] = [
    face(
        "TOP",
        [0, 0, 1],
        [
            [-1, -1, 1],
            [1, -1, 1],
            [1, 1, 1],
            [-1, 1, 1],
        ],
    ),
    face(
        "BOTTOM",
        [0, 0, -1],
        [
            [-1, -1, -1],
            [-1, 1, -1],
            [1, 1, -1],
            [1, -1, -1],
        ],
    ),
    face(
        "FRONT",
        [0, -1, 0],
        [
            [-1, -1, -1],
            [1, -1, -1],
            [1, -1, 1],
            [-1, -1, 1],
        ],
    ),
    face(
        "BACK",
        [0, 1, 0],
        [
            [1, 1, -1],
            [-1, 1, -1],
            [-1, 1, 1],
            [1, 1, 1],
        ],
    ),
    face(
        "RIGHT",
        [1, 0, 0],
        [
            [1, -1, -1],
            [1, 1, -1],
            [1, 1, 1],
            [1, -1, 1],
        ],
    ),
    face(
        "LEFT",
        [-1, 0, 0],
        [
            [-1, 1, -1],
            [-1, -1, -1],
            [-1, -1, 1],
            [-1, 1, 1],
        ],
    ),
];

export class ViewGizmo extends HTMLElement implements IViewGizmo {
    private readonly _center: Vector3;
    private readonly _canvas: HTMLCanvasElement;
    private readonly _context: CanvasRenderingContext2D;
    readonly cameraController: CameraController;
    private _canClick: boolean = true;
    private _hoverFace?: CubeFace;
    private _visibleFaces: ProjectedFace[] = [];
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
        this._hoverFace = undefined;
    };

    private readonly _onClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (!this._canClick) {
            this._canClick = true;
            return;
        }
        if (this._hoverFace) {
            const direction = this._hoverFace.direction;
            const distance = this.cameraController.camera.position.distanceTo(this.cameraController.target);
            const position = direction.clone().multiplyScalar(distance).add(this.cameraController.target);
            this.cameraController.camera.position.copy(position);
            let up = new XYZ({ x: 0, y: 0, z: 1 });
            if (direction.z === 1) up = new XYZ({ x: 0, y: 1, z: 0 });
            else if (direction.z === -1) up = new XYZ({ x: 0, y: -1, z: 0 });
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
        this._visibleFaces = this._project(invRotMat);
        this._hoverFace = this._hitTest(this._visibleFaces);
        this._draw(this._visibleFaces);
    }

    private _project(invRotMat: Matrix4): ProjectedFace[] {
        const projected: ProjectedFace[] = [];
        for (const f of FACES) {
            const normal = f.direction.clone().applyMatrix4(invRotMat);
            if (normal.z < -0.01) continue;

            let depth = 0;
            const points = f.corners.map((corner) => {
                const rotated = corner.clone().applyMatrix4(invRotMat);
                depth += rotated.z;
                return this.getBubblePosition(rotated);
            });
            projected.push({ face: f, points, depth: depth / f.corners.length });
        }
        // Painter's algorithm: farthest (smallest depth) first, so nearer
        // faces draw on top and correctly occlude it.
        projected.sort((a, b) => a.depth - b.depth);
        return projected;
    }

    private _hitTest(faces: ProjectedFace[]): CubeFace | undefined {
        if (!this._mouse || !this._canClick) return undefined;
        for (let i = faces.length - 1; i >= 0; i--) {
            if (this.pointInPolygon(this._mouse, faces[i].points)) return faces[i].face;
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

    private _draw(faces: ProjectedFace[]) {
        for (const projected of faces) {
            const isHovered = projected.face === this._hoverFace;
            this.drawFace(projected.points, isHovered);
            this.drawLabel(projected);
        }
    }

    private drawFace(points: Vector3[], isHovered: boolean) {
        this._context.beginPath();
        this._context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this._context.lineTo(points[i].x, points[i].y);
        }
        this._context.closePath();
        this._context.fillStyle = isHovered ? options.faceColorHover : options.faceColor;
        this._context.fill();
        this._context.lineWidth = options.lineWidth;
        this._context.strokeStyle = options.edgeColor;
        this._context.stroke();
    }

    private drawLabel(projected: ProjectedFace) {
        const cx = projected.points.reduce((sum, p) => sum + p.x, 0) / projected.points.length;
        const cy = projected.points.reduce((sum, p) => sum + p.y, 0) / projected.points.length;
        this._context.font = [options.fontSize, options.fontFamily].join(" ");
        this._context.fillStyle = options.labelColor;
        this._context.textBaseline = "middle";
        this._context.textAlign = "center";
        this._context.fillText(projected.face.label, cx, cy);
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
