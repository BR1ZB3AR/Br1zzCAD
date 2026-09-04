// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Plane } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import {
    SKETCH_PLANES,
    SKETCH_TOOL_KEYS,
    SketchPlaneViewModel,
    StartSketch,
} from "../../src/commands/sketch";

describe("SKETCH_PLANES mapping", () => {
    test("maps Top/Front/Right to XY/ZX/YZ", () => {
        expect(SKETCH_PLANES[0]).toBe(Plane.XY);
        expect(SKETCH_PLANES[1]).toBe(Plane.ZX);
        expect(SKETCH_PLANES[2]).toBe(Plane.YZ);
    });

    test("SKETCH_TOOL_KEYS includes 2D draw tools but not solids", () => {
        expect(SKETCH_TOOL_KEYS.has("create.line")).toBe(true);
        expect(SKETCH_TOOL_KEYS.has("create.rect")).toBe(true);
        expect(SKETCH_TOOL_KEYS.has("create.box")).toBe(false);
    });
});

describe("SketchPlaneViewModel", () => {
    test("defaults to Top selected", () => {
        const vm = new SketchPlaneViewModel();
        expect(vm.planes.selectedIndexes).toContain(0);
    });
});

describe("StartSketch", () => {
    test("has create.sketch command metadata", () => {
        const data = (StartSketch as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.sketch");
    });
});
