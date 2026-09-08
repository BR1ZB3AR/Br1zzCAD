// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, Material } from "@chili3d/core";

const SKETCH_MATERIAL_NAME = "Sketch Profile";

/**
 * A shared, fully transparent-fill material for 2D sketch profile shapes
 * (Rect, Circle, Ellipse, Polygon, ...) - drawn as an outline you can see
 * through rather than an opaque face, matching how a CAD sketch reads
 * before it's extruded into an actual solid. Created once per document
 * (found by name on later calls) and reused by every sketch shape.
 */
export function sketchProfileMaterialId(document: IDocument): string {
    const existing = document.modelManager.materials.find((m) => m.name === SKETCH_MATERIAL_NAME);
    if (existing) return existing.id;

    const material = new Material({ document, name: SKETCH_MATERIAL_NAME, color: 0x9e9e9e });
    material.opacity = 0;
    document.modelManager.materials.push(material);
    return material.id;
}
