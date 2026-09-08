// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { XYZ } from "@chili3d/core";
import { PerspectiveCamera, Vector3 } from "three";
import type { CameraController } from "../src/cameraController";
import type { ThreeView } from "../src/threeView";
import type { CubePart, ViewGizmo } from "../src/viewGizmo";

let ViewGizmoCtor: typeof ViewGizmo;
let FACES: CubePart[];
let EDGES: CubePart[];
let CORNERS: CubePart[];

beforeAll(async () => {
    // Importing the real module registers the "view-gizmo" custom element tag, but the test
    // stub (test/viewGizmo.ts, wired via the "./viewGizmo" alias used by threeView) may have
    // claimed that tag already, depending on test-file evaluation order. Skip duplicate
    // registrations so the import cannot throw in either order.
    //
    // FACES/EDGES/CORNERS are pulled from this same dynamic import (not a static top-level
    // import) - a real (non type-only) static import of anything from "../src/viewGizmo" would
    // load the module twice (once statically, once here), running its customElements.define(...)
    // call twice.
    const originalDefine = customElements.define.bind(customElements);
    customElements.define = (name, ctor, options) => {
        if (!customElements.get(name)) {
            originalDefine(name, ctor, options);
        }
    };
    let module: typeof import("../src/viewGizmo");
    try {
        module = await import("../src/viewGizmo");
    } finally {
        customElements.define = originalDefine;
    }
    ViewGizmoCtor = module.ViewGizmo;
    FACES = module.FACES;
    EDGES = module.EDGES;
    CORNERS = module.CORNERS;
    // Happy-DOM rejects `new` on unregistered custom element classes, so make sure the real
    // class is registered under some tag even when the stub owns "view-gizmo".
    if (customElements.get("view-gizmo") !== ViewGizmoCtor) {
        customElements.define("view-gizmo-real", ViewGizmoCtor);
    }
});

/**
 * Happy-DOM does not implement the 2D canvas context, so stub getContext
 * with a call-counting fake for the duration of these tests.
 */
interface Fake2dContext {
    calls: { clearRect: number; fillText: number; fill: number; stroke: number };
}

let fakeContext: Fake2dContext;
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

function createFake2dContext(): Fake2dContext {
    const calls = { clearRect: 0, fillText: 0, fill: 0, stroke: 0 };
    return {
        calls,
        clearRect: () => {
            calls.clearRect++;
        },
        beginPath: () => {},
        fill: () => {
            calls.fill++;
        },
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {
            calls.stroke++;
        },
        fillText: () => {
            calls.fillText++;
        },
        font: "",
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 0,
        textBaseline: "",
        textAlign: "",
    } as unknown as Fake2dContext;
}

beforeEach(() => {
    fakeContext = createFake2dContext();
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() =>
        fakeContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
});

interface MockController {
    camera: PerspectiveCamera;
    target: Vector3;
    rotate: ReturnType<typeof rs.fn>;
    setRotateCenterToSelected: ReturnType<typeof rs.fn>;
    lookAt: ReturnType<typeof rs.fn>;
}

function createGizmo(): { gizmo: ViewGizmo; cc: MockController; update: ReturnType<typeof rs.fn> } {
    const cc: MockController = {
        camera: new PerspectiveCamera(),
        target: new Vector3(0, 0, 0),
        rotate: rs.fn(),
        setRotateCenterToSelected: rs.fn(),
        lookAt: rs.fn(),
    };
    cc.camera.position.set(0, 0, 100);

    const update = rs.fn();
    const view = { cameraController: cc, update } as unknown as ThreeView;
    const gizmo = new ViewGizmoCtor(view);
    return { gizmo, cc, update };
}

function canvasOf(gizmo: ViewGizmo): HTMLCanvasElement {
    return (gizmo as any)._canvas;
}

function visibleLabelsOf(gizmo: ViewGizmo): string[] {
    return (gizmo as any)._visibleParts
        .map((p: { part: { label: string } }) => p.part.label)
        .filter((label: string) => label !== "");
}

function faceByLabel(label: string) {
    const face = FACES.find((f) => f.label === label);
    if (!face) throw new Error(`no such face: ${label}`);
    return face;
}

function pointerEvent(props: Record<string, unknown>): PointerEvent {
    return { stopPropagation: () => {}, ...props } as unknown as PointerEvent;
}

describe("ViewGizmo — construction and dom", () => {
    test("constructor creates a 240x240 canvas child and absolute positioning", () => {
        const { gizmo, cc } = createGizmo();

        const canvas = canvasOf(gizmo);
        expect(gizmo.children.length).toBe(1);
        expect(gizmo.children[0]).toBe(canvas);
        expect(canvas.width).toBe(240);
        expect(canvas.height).toBe(240);
        expect(gizmo.style.position).toBe("absolute");
        expect(gizmo.cameraController).toBe(cc as unknown as CameraController);
    });

    test("setDom moves the gizmo into the given element", () => {
        const { gizmo } = createGizmo();
        const dom = document.createElement("div");
        document.body.appendChild(dom);
        try {
            gizmo.setDom(dom);
            expect(dom.contains(gizmo)).toBe(true);
            expect(gizmo.parentElement).toBe(dom);
        } finally {
            dom.remove();
        }
    });

    test("dispose removes the gizmo from its parent", () => {
        const { gizmo } = createGizmo();
        const dom = document.createElement("div");
        gizmo.setDom(dom);
        expect(dom.contains(gizmo)).toBe(true);

        gizmo.dispose();
        expect(dom.contains(gizmo)).toBe(false);
    });
});

describe("ViewGizmo — chamfered cube parts", () => {
    test("has exactly six faces, one per world direction", () => {
        expect(FACES).toHaveLength(6);
        const labels = FACES.map((f) => f.label).sort();
        expect(labels).toEqual(["BACK", "BOTTOM", "FRONT", "LEFT", "RIGHT", "TOP"]);
    });

    test("each face has a unit direction, a label, and four corners", () => {
        for (const face of FACES) {
            expect(face.kind).toBe("face");
            expect(face.label).not.toBe("");
            expect(face.direction.length()).toBeCloseTo(1);
            expect(face.corners).toHaveLength(4);
        }
    });

    test("has exactly twelve edge bevels, unlabeled, with a unit direction and four corners", () => {
        expect(EDGES).toHaveLength(12);
        for (const edge of EDGES) {
            expect(edge.kind).toBe("edge");
            expect(edge.label).toBe("");
            expect(edge.direction.length()).toBeCloseTo(1);
            expect(edge.corners).toHaveLength(4);
        }
    });

    test("has exactly eight corner bevels, unlabeled, with a unit direction and three corners", () => {
        expect(CORNERS).toHaveLength(8);
        for (const corner of CORNERS) {
            expect(corner.kind).toBe("corner");
            expect(corner.label).toBe("");
            expect(corner.direction.length()).toBeCloseTo(1);
            expect(corner.corners).toHaveLength(3);
        }
    });

    test("every edge direction is the normalized sum of its two adjacent faces", () => {
        // FRONT-RIGHT edge should point diagonally between FRONT (0,-1,0) and RIGHT (1,0,0).
        const frontRight = EDGES.find(
            (e) => e.direction.x > 0.5 && e.direction.y < -0.5 && Math.abs(e.direction.z) < 0.1,
        );
        expect(frontRight).toBeDefined();
        expect(frontRight!.direction.x).toBeCloseTo(Math.SQRT1_2);
        expect(frontRight!.direction.y).toBeCloseTo(-Math.SQRT1_2);
    });

    test("every corner direction points equally along all three axes", () => {
        const topFrontRight = CORNERS.find(
            (c) => c.direction.x > 0 && c.direction.y < 0 && c.direction.z > 0,
        );
        expect(topFrontRight).toBeDefined();
        const expected = 1 / Math.sqrt(3);
        expect(topFrontRight!.direction.x).toBeCloseTo(expected);
        expect(topFrontRight!.direction.y).toBeCloseTo(-expected);
        expect(topFrontRight!.direction.z).toBeCloseTo(expected);
    });
});

describe("ViewGizmo — pointer interaction", () => {
    test("detached gizmo no longer reacts to canvas events", () => {
        const { gizmo } = createGizmo();
        document.body.appendChild(gizmo);
        gizmo.remove();

        canvasOf(gizmo).dispatchEvent(new PointerEvent("pointermove", { clientX: 5, clientY: 5 }));
        expect((gizmo as any)._mouse).toBeUndefined();
    });

    test("pointerout clears the mouse position and hovered part", () => {
        const { gizmo } = createGizmo();
        document.body.appendChild(gizmo);
        try {
            (gizmo as any)._mouse = new Vector3(1, 2, 0);
            (gizmo as any)._hoverPart = faceByLabel("TOP");
            canvasOf(gizmo).dispatchEvent(new PointerEvent("pointerout"));
            expect((gizmo as any)._mouse).toBeUndefined();
            expect((gizmo as any)._hoverPart).toBeUndefined();
        } finally {
            gizmo.remove();
        }
    });

    test("left-button drag rotates the camera by 4x the movement", () => {
        const { gizmo, cc, update } = createGizmo();

        (gizmo as any)._onPointerMove(
            pointerEvent({ buttons: 1, movementX: 2, movementY: 3, clientX: 10, clientY: 10 }),
        );

        expect(cc.rotate).toHaveBeenCalledTimes(1);
        expect(cc.rotate.mock.calls[0]).toEqual([8, 12]);
        expect((gizmo as any)._canClick).toBe(false);
        expect(update).toHaveBeenCalledTimes(1);
        // The mouse position is tracked in canvas coordinates, scaled by 2
        expect((gizmo as any)._mouse).toEqual(new Vector3(20, 20, 0));
    });

    test("pointer move without left button only tracks the mouse", () => {
        const { gizmo, cc, update } = createGizmo();

        (gizmo as any)._onPointerMove(
            pointerEvent({ buttons: 0, movementX: 2, movementY: 3, clientX: 5, clientY: 5 }),
        );

        expect(cc.rotate).not.toHaveBeenCalled();
        expect((gizmo as any)._canClick).toBe(true);
        expect(update).toHaveBeenCalledTimes(1);
    });

    test("left-button move without movement keeps the gizmo clickable", () => {
        const { gizmo, cc } = createGizmo();

        (gizmo as any)._onPointerMove(
            pointerEvent({ buttons: 1, movementX: 0, movementY: 0, clientX: 5, clientY: 5 }),
        );

        expect(cc.rotate).not.toHaveBeenCalled();
        expect((gizmo as any)._canClick).toBe(true);
    });

    test("pointerdown captures the pointer and sets the rotate center", () => {
        const { gizmo, cc } = createGizmo();
        const canvas = canvasOf(gizmo);
        canvas.setPointerCapture = rs.fn();
        canvas.releasePointerCapture = rs.fn();

        (gizmo as any)._onPointerDown(pointerEvent({ pointerId: 7 }));
        expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
        expect(cc.setRotateCenterToSelected).toHaveBeenCalledTimes(1);

        (gizmo as any)._onPointerUp(pointerEvent({ pointerId: 7 }));
        expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
    });
});

describe("ViewGizmo — click to align camera", () => {
    test("click right after a drag only re-arms clicking", () => {
        const { gizmo, cc } = createGizmo();
        (gizmo as any)._canClick = false;
        (gizmo as any)._hoverPart = faceByLabel("TOP");

        (gizmo as any)._onClick(pointerEvent({}));

        expect((gizmo as any)._canClick).toBe(true);
        expect(cc.lookAt).not.toHaveBeenCalled();
    });

    test("click without a hovered part does nothing", () => {
        const { gizmo, cc } = createGizmo();
        (gizmo as any)._hoverPart = undefined;

        (gizmo as any)._onClick(pointerEvent({}));

        expect(cc.lookAt).not.toHaveBeenCalled();
        expect(cc.camera.position.toArray()).toEqual([0, 0, 100]);
    });

    test.each([
        ["RIGHT", [100, 0, 0], [0, 0, 1]],
        ["LEFT", [-100, 0, 0], [0, 0, 1]],
        ["FRONT", [0, -100, 0], [0, 0, 1]],
        ["BACK", [0, 100, 0], [0, 0, 1]],
        ["TOP", [0, 0, 100], [0, 1, 0]],
        ["BOTTOM", [0, 0, -100], [0, -1, 0]],
    ])("click on face %s positions the camera along that face's direction", (label, expectedPos, expectedUp) => {
        const { gizmo, cc, update } = createGizmo();
        (gizmo as any)._hoverPart = faceByLabel(label);

        (gizmo as any)._onClick(pointerEvent({}));

        expect(cc.camera.position.x).toBeCloseTo(expectedPos[0]);
        expect(cc.camera.position.y).toBeCloseTo(expectedPos[1]);
        expect(cc.camera.position.z).toBeCloseTo(expectedPos[2]);
        expect(cc.lookAt).toHaveBeenCalledTimes(1);
        const up = cc.lookAt.mock.calls[0][2] as XYZ;
        expect(up.x).toBe(expectedUp[0]);
        expect(up.y).toBe(expectedUp[1]);
        expect(up.z).toBe(expectedUp[2]);
        expect(update).toHaveBeenCalledTimes(1);
    });

    test("clicking an edge bevel snaps the camera to the diagonal between its two faces", () => {
        const { gizmo, cc } = createGizmo();
        const frontRight = EDGES.find(
            (e) => e.direction.x > 0.5 && e.direction.y < -0.5 && Math.abs(e.direction.z) < 0.1,
        )!;
        (gizmo as any)._hoverPart = frontRight;
        const distance = cc.camera.position.distanceTo(cc.target);

        (gizmo as any)._onClick(pointerEvent({}));

        expect(cc.camera.position.x).toBeCloseTo(distance * Math.SQRT1_2);
        expect(cc.camera.position.y).toBeCloseTo(-distance * Math.SQRT1_2);
        expect(cc.camera.position.z).toBeCloseTo(0);
        // Not a pure +-Z direction, so the default +Z up applies (no swap).
        const up = cc.lookAt.mock.calls[0][2] as XYZ;
        expect(up.z).toBe(1);
    });

    test("clicking a corner bevel snaps the camera to the isometric direction between its three faces", () => {
        const { gizmo, cc } = createGizmo();
        const topFrontRight = CORNERS.find(
            (c) => c.direction.x > 0 && c.direction.y < 0 && c.direction.z > 0,
        )!;
        (gizmo as any)._hoverPart = topFrontRight;
        const distance = cc.camera.position.distanceTo(cc.target);
        const k = distance / Math.sqrt(3);

        (gizmo as any)._onClick(pointerEvent({}));

        expect(cc.camera.position.x).toBeCloseTo(k);
        expect(cc.camera.position.y).toBeCloseTo(-k);
        expect(cc.camera.position.z).toBeCloseTo(k);
    });
});

describe("ViewGizmo — update rendering", () => {
    test("update clears the canvas, draws every visible part, and labels only the visible faces", () => {
        const { gizmo } = createGizmo();

        gizmo.update();

        expect(fakeContext.calls.clearRect).toBe(1);
        const visibleParts = (gizmo as any)._visibleParts as { part: CubePart }[];
        expect(visibleParts.length).toBeGreaterThan(0);
        expect(fakeContext.calls.fill).toBe(visibleParts.length);
        expect(fakeContext.calls.stroke).toBe(visibleParts.length);
        const labeledCount = visibleParts.filter((p) => p.part.label !== "").length;
        expect(fakeContext.calls.fillText).toBe(labeledCount);
        expect(labeledCount).toBeGreaterThan(0);
    });

    test("TOP faces the default (identity-rotation) camera and is visible", () => {
        const { gizmo } = createGizmo();

        gizmo.update();

        expect(visibleLabelsOf(gizmo)).toContain("TOP");
    });

    test("rotating the camera 180 degrees about Y swaps TOP for BOTTOM", () => {
        const { gizmo, cc } = createGizmo();
        gizmo.update();
        expect(visibleLabelsOf(gizmo)).toContain("TOP");
        expect(visibleLabelsOf(gizmo)).not.toContain("BOTTOM");

        cc.camera.rotation.y = Math.PI;
        gizmo.update();

        expect(visibleLabelsOf(gizmo)).not.toContain("TOP");
        expect(visibleLabelsOf(gizmo)).toContain("BOTTOM");
    });

    test("update hovers the face under the mouse (TOP projects to the widget's center)", () => {
        const { gizmo } = createGizmo();

        (gizmo as any)._mouse = new Vector3(120, 120, 0);
        gizmo.update();

        expect((gizmo as any)._hoverPart?.label).toBe("TOP");
    });

    test("update hovers nothing when the mouse is far from every part", () => {
        const { gizmo } = createGizmo();

        (gizmo as any)._mouse = new Vector3(0, 0, 0);
        gizmo.update();

        expect((gizmo as any)._hoverPart).toBeUndefined();
    });

    test("a hovered part from update is clickable", () => {
        const { gizmo, cc } = createGizmo();

        (gizmo as any)._mouse = new Vector3(120, 120, 0);
        gizmo.update();
        expect((gizmo as any)._hoverPart?.label).toBe("TOP");

        (gizmo as any)._onClick(pointerEvent({}));
        expect(cc.lookAt).toHaveBeenCalledTimes(1);
        expect(cc.camera.position.z).toBeCloseTo(100);
    });
});
