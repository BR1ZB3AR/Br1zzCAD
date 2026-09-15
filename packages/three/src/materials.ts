// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type SketchDofStatus, VisualConfig, type VisualItemConfig } from "@chili3d/core";
import { DoubleSide, MeshLambertMaterial, PointsMaterial } from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { ThreeHelper } from "./threeHelper";

export const defaultVertexMaterial = new PointsMaterial({
    color: ThreeHelper.fromColor(VisualConfig.defaultEdgeColor),
    sizeAttenuation: false,
    size: 3,
});

export const highlightVertexMaterial = new PointsMaterial({
    color: ThreeHelper.fromColor(VisualConfig.highlightEdgeColor),
    sizeAttenuation: false,
    size: 5,
});

export const selectedVertexMaterial = new PointsMaterial({
    color: ThreeHelper.fromColor(VisualConfig.selectedEdgeColor),
    sizeAttenuation: false,
    size: 5,
});

export const defaultEdgeMaterial = new LineMaterial({
    linewidth: 1,
    color: VisualConfig.defaultEdgeColor,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
});

/** Sketch entity coloring while its constraint status is under review (see
 * `analyzeSketchDOF`/`ThreeSketchDofCoordinator`) - shared singletons
 * swapped by reference on solid edges, same as `defaultEdgeMaterial`
 * already is one; a dashed (construction) edge instead gets its own
 * per-instance material's color mutated directly (see
 * `ThreeGeometry.setDofStatus`), so these two aren't used for that case. */
export const dofUnderConstrainedEdgeMaterial = new LineMaterial({
    linewidth: 1,
    color: VisualConfig.dofUnderConstrainedColor,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
});

export const dofConflictingEdgeMaterial = new LineMaterial({
    linewidth: 1,
    color: VisualConfig.dofConflictingColor,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
});

VisualConfig.onPropertyChanged((property: keyof VisualItemConfig) => {
    if (property === "defaultEdgeColor") {
        defaultEdgeMaterial.color.set(VisualConfig.defaultEdgeColor);
        defaultVertexMaterial.color.set(VisualConfig.defaultEdgeColor);
    }
    if (property === "dofUnderConstrainedColor") {
        dofUnderConstrainedEdgeMaterial.color.set(VisualConfig.dofUnderConstrainedColor);
    }
    if (property === "dofConflictingColor") {
        dofConflictingEdgeMaterial.color.set(VisualConfig.dofConflictingColor);
    }
});

/** "Fully constrained" deliberately has no material of its own - it reuses
 * `defaultEdgeMaterial`/`defaultEdgeColor`, which already adapts across
 * light/dark themes the same way a plain black/white "locked" indicator
 * would need to (see `VisualItemConfig.dofUnderConstrainedColor`'s doc). */
export function dofEdgeMaterial(status: SketchDofStatus): LineMaterial {
    switch (status) {
        case "underConstrained":
            return dofUnderConstrainedEdgeMaterial;
        case "conflicting":
            return dofConflictingEdgeMaterial;
        case "fullyConstrained":
            return defaultEdgeMaterial;
    }
}

export function dofColor(status: SketchDofStatus): number {
    switch (status) {
        case "underConstrained":
            return VisualConfig.dofUnderConstrainedColor;
        case "conflicting":
            return VisualConfig.dofConflictingColor;
        case "fullyConstrained":
            return VisualConfig.defaultEdgeColor;
    }
}

export const hilightEdgeMaterial = new LineMaterial({
    linewidth: 3,
    color: ThreeHelper.fromColor(VisualConfig.highlightEdgeColor),
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
});

/** Hover state for a dashed edge (e.g. construction geometry) - same cadence as
 * the non-highlighted dash (`ThreeGeometryFactory.createEdgeMaterial`) so the
 * pattern doesn't visibly shift when the mouse moves over it. */
export const hilightDashedEdgeMaterial = new LineMaterial({
    linewidth: 3,
    color: ThreeHelper.fromColor(VisualConfig.highlightEdgeColor),
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    dashed: true,
    dashScale: 1,
    dashSize: 15,
    gapSize: 10,
});

export const selectedEdgeMaterial = new LineMaterial({
    linewidth: 3,
    color: ThreeHelper.fromColor(VisualConfig.selectedEdgeColor),
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
});

/** Selected state for a dashed edge - see `hilightDashedEdgeMaterial`. */
export const selectedDashedEdgeMaterial = new LineMaterial({
    linewidth: 3,
    color: ThreeHelper.fromColor(VisualConfig.selectedEdgeColor),
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    dashed: true,
    dashScale: 1,
    dashSize: 15,
    gapSize: 10,
});

/** A construction shape's face (see `ThreeGeometry.isConstructionNode`) -
 * fully invisible rather than the faint `sketchProfileMaterialId` tint, so a
 * closed construction loop never reads as "this is a solid region" the way
 * a real (non-construction) profile does, matching FreeCAD. The face
 * geometry itself is untouched, so the interior stays click-selectable. */
export const constructionFaceMaterial = new MeshLambertMaterial({
    transparent: true,
    side: DoubleSide,
    opacity: 0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
});

export const faceTransparentMaterial = new MeshLambertMaterial({
    transparent: true,
    side: DoubleSide,
    color: ThreeHelper.fromColor(VisualConfig.selectedFaceColor),
    opacity: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
});

export const selectedFaceColoredMaterial = new MeshLambertMaterial({
    side: DoubleSide,
    color: ThreeHelper.fromColor(VisualConfig.selectedFaceColor),
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
});

export const highlightFaceMaterial = new MeshLambertMaterial({
    color: ThreeHelper.fromColor(VisualConfig.highlightFaceColor),
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
});

export const lockFaceMaterial = new MeshLambertMaterial({
    color: 0x6a6a6a,
    transparent: true,
    opacity: 0.5,
});

export const lockLineMaterial = new LineMaterial({
    color: 0x6a6a6a,
    transparent: true,
    opacity: 0.5,
});
