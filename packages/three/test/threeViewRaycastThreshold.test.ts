// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { NodeSelectionHandler } from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import { ThreeVisual } from "../src/threeVisual";
import { TestView } from "./testView";

function createView() {
    const doc = new TestDocument();
    const visual = new ThreeVisual(doc, new NodeSelectionHandler(doc, true));
    doc.visual = visual;
    return new TestView(doc, visual.context);
}

/**
 * Regression coverage for the bug behind "clicking a sketch point's vertex
 * marker only works at one specific zoom level" - `Points.threshold` (used
 * to hit-test a picked vertex) is interpreted by Three.js as a raw
 * world-space distance, unlike `Line2`'s own raycasting (already
 * screen-space via its material's `resolution`). Passing a pixel-intended
 * config value straight through made the *world-space* hit radius around
 * a vertex marker constant regardless of how far the camera is from it -
 * so the same 16px only covered the marker at whatever distance the
 * threshold happened to have been tuned for.
 */
describe("ThreeView.pixelsToWorldThreshold", () => {
    test("is not a fixed world-space constant equal to the pixel count", () => {
        const view = createView();
        const threshold = (view as any).pixelsToWorldThreshold(16);
        expect(threshold).not.toBe(16);
    });

    test("perspective: scales linearly with camera-to-target distance", () => {
        const view = createView();
        const near = (view as any).pixelsToWorldThreshold(16);

        view.camera.position.set(0, 0, 1000); // 10x farther than TestView's default (0,0,100)
        const far = (view as any).pixelsToWorldThreshold(16);

        // A vertex marker further from the camera needs a proportionally
        // larger world-space hit radius to still cover the same 16
        // screen pixels - a fixed threshold (the old bug) would keep this
        // ratio at 1, not 10.
        expect(far / near).toBeCloseTo(10, 4);
    });

    test("perspective: scales linearly with the requested pixel count", () => {
        const view = createView();
        const eight = (view as any).pixelsToWorldThreshold(8);
        const sixteen = (view as any).pixelsToWorldThreshold(16);
        expect(sixteen / eight).toBeCloseTo(2, 6);
    });

    test("orthographic: derived from the current frustum half-height, not the raw pixel count", () => {
        const view = createView();
        view.cameraController.cameraType = "orthographic";

        const threshold = (view as any).pixelsToWorldThreshold(16);

        const camera = view.camera as any;
        const worldPerPixel = (camera.top - camera.bottom) / camera.zoom / view.height;
        expect(threshold).toBeCloseTo(16 * worldPerPixel, 6);
    });
});
