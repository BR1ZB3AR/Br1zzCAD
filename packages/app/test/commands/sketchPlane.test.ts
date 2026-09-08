// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Plane, PubSub } from "@chili3d/core";
import { createMockApplication, createMockDocument } from "@chili3d/core/test-utils";
import { PlanePickerCube } from "@chili3d/element";
import { afterEach, beforeEach, describe, expect, test } from "@rstest/core";
import { PickSketchPlane } from "../../src/commands/sketchPlane";

// Happy-DOM does not implement the 2D canvas context that PlanePickerCube
// draws itself with - stub it out so constructing the cube doesn't throw.
const fakeContext = {
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    fillText: () => {},
} as unknown as CanvasRenderingContext2D;

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = (() =>
        fakeContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe("PickSketchPlane", () => {
    test("should have command metadata", () => {
        const data = (PickSketchPlane as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("sketch.pickPlane");
        expect(data.icon).toBe("icon-setWorkingPlane");
    });

    test("should do nothing when activeView is undefined", async () => {
        let dialogShown = false;
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string) => {
            if (channel === "showDialog") dialogShown = true;
        }) as any;

        try {
            const app = createMockApplication();
            app.activeView = undefined;

            const cmd = new PickSketchPlane();
            await expect(cmd.execute(app)).resolves.toBeUndefined();
            expect(dialogShown).toBe(false);
        } finally {
            PubSub.default.pub = originalPub;
        }
    });

    test("should show a dialog containing a PlanePickerCube when activeView exists", async () => {
        let capturedTitle: string | undefined;
        let capturedContent: unknown;
        let capturedButtons: unknown;
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, ...args: unknown[]) => {
            if (channel === "showDialog") {
                [capturedTitle, capturedContent, capturedButtons] = args as [string, unknown, unknown];
            }
        }) as any;

        try {
            const app = createMockApplication();
            app.activeView = { document: createMockDocument(), workplane: Plane.XY } as any;

            const cmd = new PickSketchPlane();
            await cmd.execute(app);

            expect(capturedTitle).toBe("dialog.title.pickSketchPlane");
            expect(capturedContent).toBeInstanceOf(PlanePickerCube);
            expect(Array.isArray(capturedButtons)).toBe(true);
            expect((capturedButtons as { content: string }[])[0].content).toBe("common.cancel");
        } finally {
            PubSub.default.pub = originalPub;
        }
    });

    test.each([
        ["XY", Plane.XY],
        ["YZ", Plane.YZ],
        ["ZX", Plane.ZX],
    ])("picking %s on the cube sets the view's workplane", async (planeKey, expectedPlane) => {
        let capturedContent: PlanePickerCube | undefined;
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, ...args: unknown[]) => {
            if (channel === "showDialog") capturedContent = args[1] as PlanePickerCube;
        }) as any;

        try {
            const app = createMockApplication();
            const view: any = { document: createMockDocument(), workplane: Plane.XY };
            app.activeView = view;

            const cmd = new PickSketchPlane();
            await cmd.execute(app);

            expect(capturedContent).toBeInstanceOf(PlanePickerCube);
            (capturedContent as any).onPick(planeKey);

            expect(view.workplane.normal.isEqualTo(expectedPlane.normal)).toBe(true);
            expect(view.workplane.xvec.isEqualTo(expectedPlane.xvec)).toBe(true);
        } finally {
            PubSub.default.pub = originalPub;
        }
    });
});
