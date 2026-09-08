// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

export type PickablePlane = "XY" | "YZ" | "ZX";

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

interface CubeFace {
    key: PickablePlane;
    label: string;
    normal: Vec3;
    corners: Vec3[];
}

interface ProjectedFace {
    face: CubeFace;
    points: [number, number][];
    depth: number;
}

const SIZE = 220;
const HALF = SIZE / 2;
const CUBE_SCALE = 78;
const DRAG_SPEED = 0.01;

// Unit cube, Z-up (matching the app's world axes). Each pair of opposite
// faces maps to the same sketch plane - which side you rotate to and click
// doesn't matter, only which axis it's perpendicular to.
const FACES: CubeFace[] = [
    {
        key: "XY",
        label: "TOP",
        normal: [0, 0, 1],
        corners: [
            [-1, -1, 1],
            [1, -1, 1],
            [1, 1, 1],
            [-1, 1, 1],
        ],
    },
    {
        key: "XY",
        label: "BOTTOM",
        normal: [0, 0, -1],
        corners: [
            [-1, -1, -1],
            [-1, 1, -1],
            [1, 1, -1],
            [1, -1, -1],
        ],
    },
    {
        key: "ZX",
        label: "FRONT",
        normal: [0, -1, 0],
        corners: [
            [-1, -1, -1],
            [1, -1, -1],
            [1, -1, 1],
            [-1, -1, 1],
        ],
    },
    {
        key: "ZX",
        label: "BACK",
        normal: [0, 1, 0],
        corners: [
            [1, 1, -1],
            [-1, 1, -1],
            [-1, 1, 1],
            [1, 1, 1],
        ],
    },
    {
        key: "YZ",
        label: "RIGHT",
        normal: [1, 0, 0],
        corners: [
            [1, -1, -1],
            [1, 1, -1],
            [1, 1, 1],
            [1, -1, 1],
        ],
    },
    {
        key: "YZ",
        label: "LEFT",
        normal: [-1, 0, 0],
        corners: [
            [-1, 1, -1],
            [-1, -1, -1],
            [-1, -1, 1],
            [-1, 1, 1],
        ],
    },
];

const FACE_COLORS: Record<PickablePlane, string> = {
    XY: "#178cf0",
    YZ: "#f73c3c",
    ZX: "#6ccb26",
};

function multiply(a: Mat3, b: Mat3): Mat3 {
    const r: Mat3 = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
        }
    }
    return r;
}

function rotateX(angle: number): Mat3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [1, 0, 0],
        [0, c, -s],
        [0, s, c],
    ];
}

function rotateZ(angle: number): Mat3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        [c, -s, 0],
        [s, c, 0],
        [0, 0, 1],
    ];
}

function apply(m: Mat3, v: Vec3): Vec3 {
    return [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ];
}

function pointInPolygon(x: number, y: number, points: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (crosses) inside = !inside;
    }
    return inside;
}

function withAlpha(hex: string, alpha: number): string {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A rotatable, clickable cube for picking one of the three axis-aligned
 * sketch planes (Top/Bottom -> XY, Front/Back -> ZX, Right/Left -> YZ). Pure
 * canvas + manual 3D math - no Three.js dependency, since it doesn't need to
 * reflect the real scene, just let the user orient it and click a face.
 */
export class PlanePickerCube extends HTMLElement {
    private readonly _canvas: HTMLCanvasElement;
    private readonly _context: CanvasRenderingContext2D;
    private _matrix: Mat3;
    private _canClick = true;
    private _hoverFace?: CubeFace;
    private _visibleFaces: ProjectedFace[] = [];

    constructor(private readonly onPick: (plane: PickablePlane) => void) {
        super();
        this._matrix = multiply(rotateX(-0.55), rotateZ(0.7));
        this._canvas = this.initCanvas();
        this._context = this._canvas.getContext("2d")!;
        this.initStyle();
        this.render();
    }

    private initStyle() {
        this.style.display = "block";
        this.style.userSelect = "none";
        this.style.webkitUserSelect = "none";
        this.style.touchAction = "none";
    }

    private initCanvas() {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        canvas.style.width = `${SIZE}px`;
        canvas.style.height = `${SIZE}px`;
        canvas.style.cursor = "grab";
        this.append(canvas);
        return canvas;
    }

    connectedCallback() {
        this._canvas.addEventListener("pointerdown", this.onPointerDown);
        this._canvas.addEventListener("pointermove", this.onPointerMove);
        this._canvas.addEventListener("pointerup", this.onPointerUp);
        this._canvas.addEventListener("pointerleave", this.onPointerLeave);
        this._canvas.addEventListener("click", this.onClick);
    }

    disconnectedCallback() {
        this._canvas.removeEventListener("pointerdown", this.onPointerDown);
        this._canvas.removeEventListener("pointermove", this.onPointerMove);
        this._canvas.removeEventListener("pointerup", this.onPointerUp);
        this._canvas.removeEventListener("pointerleave", this.onPointerLeave);
        this._canvas.removeEventListener("click", this.onClick);
    }

    private readonly onPointerDown = (e: PointerEvent) => {
        e.stopPropagation();
        this._canvas.setPointerCapture(e.pointerId);
        this._canvas.style.cursor = "grabbing";
    };

    private readonly onPointerUp = (e: PointerEvent) => {
        e.stopPropagation();
        this._canvas.releasePointerCapture(e.pointerId);
        this._canvas.style.cursor = "grab";
    };

    private readonly onPointerLeave = (e: PointerEvent) => {
        e.stopPropagation();
        this._hoverFace = undefined;
        this.render();
    };

    private readonly onPointerMove = (e: PointerEvent) => {
        e.stopPropagation();
        if (e.buttons === 1 && (e.movementX !== 0 || e.movementY !== 0)) {
            const drag = multiply(rotateX(-e.movementY * DRAG_SPEED), rotateZ(e.movementX * DRAG_SPEED));
            this._matrix = multiply(drag, this._matrix);
            this._canClick = false;
            this.render();
            return;
        }
        this._hoverFace = this.hitTest(...this.canvasPoint(e));
        this.render();
    };

    private readonly onClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (!this._canClick) {
            this._canClick = true;
            return;
        }
        const face = this.hitTest(...this.canvasPoint(e));
        if (face) {
            this.onPick(face.key);
        }
    };

    private canvasPoint(e: MouseEvent): [number, number] {
        const rect = this._canvas.getBoundingClientRect();
        // rect.width/height can be 0 before layout has run (e.g. tests, or a
        // canvas not yet attached) - fall back to unscaled client coordinates
        // rather than dividing by zero.
        const scaleX = rect.width > 0 ? SIZE / rect.width : 1;
        const scaleY = rect.height > 0 ? SIZE / rect.height : 1;
        return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
    }

    private hitTest(x: number, y: number): CubeFace | undefined {
        for (let i = this._visibleFaces.length - 1; i >= 0; i--) {
            const projected = this._visibleFaces[i];
            if (pointInPolygon(x, y, projected.points)) return projected.face;
        }
        return undefined;
    }

    private project(): ProjectedFace[] {
        const projected: ProjectedFace[] = [];
        for (const face of FACES) {
            const normal = apply(this._matrix, face.normal);
            if (normal[1] >= 0) continue;

            let depth = 0;
            const points: [number, number][] = face.corners.map((corner) => {
                const rotated = apply(this._matrix, corner);
                depth += rotated[1];
                return [HALF + rotated[0] * CUBE_SCALE, HALF - rotated[2] * CUBE_SCALE];
            });
            projected.push({ face, points, depth: depth / face.corners.length });
        }
        // Painter's algorithm: farthest face (largest depth along the view
        // axis) first, so the nearer faces draw on top and occlude it.
        projected.sort((a, b) => b.depth - a.depth);
        return projected;
    }

    private render() {
        const ctx = this._context;
        ctx.clearRect(0, 0, SIZE, SIZE);
        this._visibleFaces = this.project();

        for (const projected of this._visibleFaces) {
            const isHovered = projected.face === this._hoverFace;
            ctx.beginPath();
            ctx.moveTo(projected.points[0][0], projected.points[0][1]);
            for (let i = 1; i < projected.points.length; i++) {
                ctx.lineTo(projected.points[i][0], projected.points[i][1]);
            }
            ctx.closePath();
            ctx.fillStyle = withAlpha(FACE_COLORS[projected.face.key], isHovered ? 0.85 : 0.55);
            ctx.fill();
            ctx.strokeStyle = "#151515";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            const cx = projected.points.reduce((sum, p) => sum + p[0], 0) / projected.points.length;
            const cy = projected.points.reduce((sum, p) => sum + p[1], 0) / projected.points.length;
            ctx.fillStyle = "#151515";
            ctx.font = "bold 13px arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(projected.face.label, cx, cy);
        }
    }
}

customElements.define("plane-picker-cube", PlanePickerCube);
