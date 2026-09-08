// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, describe, expect, rs, test } from "@rstest/core";
import { PlanePickerCube } from "../src/planePickerCube";

/** Happy-DOM does not implement the 2D canvas context - stub it with a fake
 * that just records draw calls, matching the pattern used for ViewGizmo. */
interface FakeContext {
    calls: { clearRect: number; fill: number; stroke: number; fillText: number };
}

let fakeContext: FakeContext;
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

function createFakeContext(): FakeContext {
    const calls = { clearRect: 0, fill: 0, stroke: 0, fillText: 0 };
    return {
        calls,
        clearRect: () => {
            calls.clearRect++;
        },
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {
            calls.fill++;
        },
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
        textAlign: "",
        textBaseline: "",
    } as unknown as FakeContext;
}

beforeEach(() => {
    fakeContext = createFakeContext();
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() =>
        fakeContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
});

function canvasOf(cube: PlanePickerCube): HTMLCanvasElement {
    return (cube as any)._canvas;
}

function pointerMoveEvent(props: Partial<PointerEventInit> = {}): PointerEvent {
    return new PointerEvent("pointermove", { clientX: 0, clientY: 0, buttons: 0, ...props });
}

function clickEvent(x: number, y: number): MouseEvent {
    return new MouseEvent("click", { clientX: x, clientY: y });
}

describe("PlanePickerCube — construction and dom", () => {
    test("constructor creates a 220x220 canvas child", () => {
        const onPick = rs.fn();
        const cube = new PlanePickerCube(onPick);
        const canvas = canvasOf(cube);

        expect(cube.children.length).toBe(1);
        expect(cube.children[0]).toBe(canvas);
        expect(canvas.width).toBe(220);
        expect(canvas.height).toBe(220);
    });

    test("renders on construction (clears and draws at least one face)", () => {
        new PlanePickerCube(rs.fn());
        expect(fakeContext.calls.clearRect).toBeGreaterThan(0);
        expect(fakeContext.calls.fill).toBeGreaterThan(0);
        expect(fakeContext.calls.fillText).toBeGreaterThan(0);
    });
});

describe("PlanePickerCube — pointer interaction", () => {
    test("dragging with the left button held rotates the cube and re-renders without a click", () => {
        const onPick = rs.fn();
        const cube = new PlanePickerCube(onPick);
        document.body.appendChild(cube);
        try {
            const fillsBefore = fakeContext.calls.fill;

            canvasOf(cube).dispatchEvent(pointerMoveEvent({ buttons: 1, movementX: 15, movementY: -8 }));
            expect(fakeContext.calls.fill).toBeGreaterThan(fillsBefore);
            expect((cube as any)._canClick).toBe(false);

            // A drag should not itself count as a pick.
            canvasOf(cube).dispatchEvent(clickEvent(110, 110));
            expect(onPick).not.toHaveBeenCalled();
        } finally {
            cube.remove();
        }
    });

    test("clicking the center of the cube (no prior drag) picks one of the three planes", () => {
        const onPick = rs.fn();
        const cube = new PlanePickerCube(onPick);
        document.body.appendChild(cube);
        try {
            canvasOf(cube).dispatchEvent(clickEvent(110, 110));
            expect(onPick).toHaveBeenCalledTimes(1);
            expect(["XY", "YZ", "ZX"]).toContain(onPick.mock.calls[0][0]);
        } finally {
            cube.remove();
        }
    });

    test("clicking outside every face does not call onPick", () => {
        const onPick = rs.fn();
        const cube = new PlanePickerCube(onPick);
        document.body.appendChild(cube);
        try {
            // Far corner of the canvas, well outside the projected cube.
            canvasOf(cube).dispatchEvent(clickEvent(2, 2));
            expect(onPick).not.toHaveBeenCalled();
        } finally {
            cube.remove();
        }
    });

    test("pointerleave clears the hovered face and re-renders", () => {
        const cube = new PlanePickerCube(rs.fn());
        document.body.appendChild(cube);
        try {
            (cube as any)._hoverFace = { key: "XY" };
            canvasOf(cube).dispatchEvent(new PointerEvent("pointerleave"));
            expect((cube as any)._hoverFace).toBeUndefined();
        } finally {
            cube.remove();
        }
    });

    test("detached cube no longer reacts to canvas events", () => {
        const onPick = rs.fn();
        const cube = new PlanePickerCube(onPick);
        document.body.appendChild(cube);
        cube.remove();

        canvasOf(cube).dispatchEvent(clickEvent(110, 110));
        expect(onPick).not.toHaveBeenCalled();
    });
});
