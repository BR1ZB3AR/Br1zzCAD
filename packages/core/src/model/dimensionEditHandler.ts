// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { DimensionAnnotation } from "./annotation";
import type { VisualNode } from "./visualNode";

/**
 * Called with the value the user typed while editing a dimension; returns
 * true if the edit was accepted (and the caller should update the
 * annotation's own points to match), false to reject it (e.g. a value that
 * would collapse the measured geometry).
 */
export type DimensionEditHandler = (newValue: number) => boolean;

/**
 * A session-local (not serialized) link from a DimensionAnnotation to the
 * command-specific logic that knows how to write an edited value back to
 * the single shape it measures (a Line's length, a Circle's radius, ...).
 * Lives here (not in `three`, which renders the edit UI, or `app`, which
 * creates the handler) so both can reach it without a layering violation.
 * A handler set in one session doesn't survive a reload - re-editing a
 * dimension after reopening the document isn't supported yet.
 */
const handlers = new WeakMap<DimensionAnnotation, DimensionEditHandler>();

export function setDimensionEditHandler(annotation: DimensionAnnotation, handler: DimensionEditHandler) {
    handlers.set(annotation, handler);
}

export function getDimensionEditHandler(annotation: DimensionAnnotation): DimensionEditHandler | undefined {
    return handlers.get(annotation);
}

/**
 * A session-local (not serialized) link from a DimensionAnnotation to the
 * shape(s) it measures - set regardless of whether an edit handler exists
 * (an Arc's radius or a Polygon's edge aren't editable, but should still be
 * tracked). Lets Move/Rotate/Mirror carry an unselected dimension along
 * with the shape it's measuring, instead of requiring it to be selected
 * alongside that shape every time. Same reload caveat as the edit handler.
 */
const measuredNodes = new WeakMap<DimensionAnnotation, VisualNode[]>();

export function setDimensionMeasuredNodes(annotation: DimensionAnnotation, nodes: VisualNode[]) {
    measuredNodes.set(annotation, nodes);
}

export function getDimensionMeasuredNodes(annotation: DimensionAnnotation): VisualNode[] | undefined {
    return measuredNodes.get(annotation);
}
