// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { createMockDocument } from "@chili3d/core/test-utils";
import { describe, expect, test } from "@rstest/core";
import { sketchProfileMaterialId } from "../../src/bodys/sketchMaterial";

describe("sketchProfileMaterialId", () => {
    test("creates a faint (10% opacity) material on first use", () => {
        const doc = createMockDocument();

        const id = sketchProfileMaterialId(doc);

        const material = doc.modelManager.materials.find((m) => m.id === id);
        expect(material).toBeDefined();
        expect(material!.opacity).toBe(0.1);
        expect(material!.name).toBe("Sketch Profile");
    });

    test("reuses the same material id on later calls instead of creating duplicates", () => {
        const doc = createMockDocument();

        const first = sketchProfileMaterialId(doc);
        const second = sketchProfileMaterialId(doc);

        expect(second).toBe(first);
        expect(doc.modelManager.materials.filter((m) => m.name === "Sketch Profile")).toHaveLength(1);
    });

    test("each document gets its own material", () => {
        const docA = createMockDocument();
        const docB = createMockDocument();

        const idA = sketchProfileMaterialId(docA);
        const idB = sketchProfileMaterialId(docB);

        expect(docA.modelManager.materials.find((m) => m.id === idA)!.document).toBe(docA);
        expect(docB.modelManager.materials.find((m) => m.id === idB)!.document).toBe(docB);
    });
});
