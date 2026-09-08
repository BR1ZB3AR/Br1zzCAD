// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, Material } from "@chili3d/core";

const SKETCH_MATERIAL_NAME = "Sketch Profile";

/** Only closed-loop sketch shapes (Rect/Circle/Ellipse/Polygon with isFace
 * true) ever generate a face using this material at all - an open Line/Arc/
 * Bezier has no fill to apply it to - so a faint, non-zero opacity here
 * still reads as "just an outline" for those, while giving a closed profile
 * a slight tint to set it apart from an open one. */
const SKETCH_PROFILE_OPACITY = 0.1;

/**
 * A shared, mostly-transparent-fill material for 2D sketch profile shapes
 * (Rect, Circle, Ellipse, Polygon, ...) - drawn as a faintly tinted outline
 * rather than an opaque face, matching how a CAD sketch reads before it's
 * extruded into an actual solid. Created once per document (found by name
 * on later calls) and reused by every sketch shape.
 */
export function sketchProfileMaterialId(document: IDocument): string {
    const existing = document.modelManager.materials.find((m) => m.name === SKETCH_MATERIAL_NAME);
    if (existing) return existing.id;

    const material = new Material({ document, name: SKETCH_MATERIAL_NAME, color: 0x9e9e9e });
    material.opacity = SKETCH_PROFILE_OPACITY;
    document.modelManager.materials.push(material);
    return material.id;
}
