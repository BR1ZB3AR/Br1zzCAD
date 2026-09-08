// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IEventHandler, IView } from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import { rs } from "@rstest/core";
import { AxesHelper, Scene } from "three";
import { ThreeMeshExporter } from "../src/meshExporter";
import { ThreeHighlighter } from "../src/threeHighlighter";
import { ThreeVisual } from "../src/threeVisual";
import { ThreeVisualContext } from "../src/threeVisualContext";

class TestEventHandler implements IEventHandler {
    isEnabled = true;
    pointerMove(_view: IView, _event: PointerEvent): void {}
    pointerDown(_view: IView, _event: PointerEvent): void {}
    pointerUp(_view: IView, _event: PointerEvent): void {}
    keyDown(_view: IView, _event: KeyboardEvent): void {}
    dispose(): void {}
}

describe("ThreeVisual", () => {
    const createdVisuals: ThreeVisual[] = [];

    afterEach(() => {
        for (const v of createdVisuals) {
            if (v.scene.children.length > 0) {
                v.dispose();
            }
        }
        createdVisuals.length = 0;
    });

    function createTestVisual() {
        const doc = new TestDocument();
        const eventHandler = new TestEventHandler();
        const visual = new ThreeVisual(doc, eventHandler);
        createdVisuals.push(visual);
        return { doc, visual, eventHandler };
    }

    test("initScene creates scene with ambient light and axes helper", () => {
        const { visual } = createTestVisual();
        expect(visual.scene).toBeInstanceOf(Scene);
        expect(visual.scene.children.length).toBeGreaterThanOrEqual(2);
    });

    test("context, highlighter, meshExporter are initialized", () => {
        const { visual } = createTestVisual();
        expect(visual.context).toBeInstanceOf(ThreeVisualContext);
        expect(visual.highlighter).toBeInstanceOf(ThreeHighlighter);
        expect(visual.meshExporter).toBeInstanceOf(ThreeMeshExporter);
    });

    test("defaultEventHandler and viewHandler are initialized", () => {
        const { visual } = createTestVisual();
        expect(typeof visual.defaultEventHandler.pointerMove).toBe("function");
        expect(typeof visual.viewHandler.pointerMove).toBe("function");
        expect(visual.eventHandler).toBe(visual.defaultEventHandler);
    });

    test("eventHandler can be swapped", () => {
        const { visual } = createTestVisual();
        const newHandler = new TestEventHandler();
        visual.eventHandler = newHandler;
        expect(visual.eventHandler).toBe(newHandler);
    });

    test("dispose clears scene children", () => {
        const { visual } = createTestVisual();
        const scene = visual.scene;
        expect(scene.children.length).toBeGreaterThan(0);

        visual.dispose();
        expect(scene.children.length).toBe(0);
    });

    describe("showOrigin", () => {
        test("defaults to true", () => {
            const { visual } = createTestVisual();
            expect(visual.showOrigin).toBe(true);
        });

        test("setter toggles the AxesHelper's own visible flag in the scene", () => {
            const { visual } = createTestVisual();
            const axesHelper = visual.scene.children.find((c): c is AxesHelper => c instanceof AxesHelper);
            expect(axesHelper).toBeDefined();

            visual.showOrigin = false;
            expect(axesHelper?.visible).toBe(false);
            expect(visual.showOrigin).toBe(false);

            visual.showOrigin = true;
            expect(axesHelper?.visible).toBe(true);
            expect(visual.showOrigin).toBe(true);
        });

        test("setter triggers a view update", () => {
            const { visual } = createTestVisual();
            const updateSpy = rs.fn();
            visual.update = updateSpy;

            visual.showOrigin = false;

            expect(updateSpy).toHaveBeenCalledTimes(1);
        });
    });
});
