// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument } from "../document";
import { Id, PropertyHistoryRecord, Transaction } from "../foundation";
import { I18n, type I18nKeys } from "../i18n";
import type { BoundingBox } from "../math";
import { property } from "../property";
import { serializable, serialize } from "../serialize";
import { DistanceConstraint, type SketchConstraint } from "./sketchConstraint";
import { VisualNode } from "./visualNode";

export interface SketchConstraintNodeOptions {
    document: IDocument;
    constraint: SketchConstraint;
    id?: string;
}

const DISPLAY_KEYS: Record<string, I18nKeys> = {
    coincident: "body.constraint.coincident",
    horizontal: "body.constraint.horizontal",
    vertical: "body.constraint.vertical",
    parallel: "body.constraint.parallel",
    perpendicular: "body.constraint.perpendicular",
    equal: "body.constraint.equal",
    fixed: "body.constraint.fixed",
    distance: "body.constraint.distance",
};

/**
 * A geometric constraint (Coincident, Horizontal, ...) as a real tree node,
 * not just data - a genuine child of the `SketchGroupNode` it applies to
 * (see `SketchGroupNode.constraints`, which reads these back out rather
 * than storing its own array). Being a plain `VisualNode` gets it the
 * Items tree entry, the generic `modify.deleteNode` command, and
 * undo/redo, all for free - no bespoke visibility or deletion mechanism
 * needed, matching how `DimensionAnnotation` already works.
 */
@serializable()
export class SketchConstraintNode extends VisualNode {
    @serialize()
    readonly constraint: SketchConstraint;

    constructor(options: SketchConstraintNodeOptions) {
        // Name is set below once `constraint` is assigned - `display()`
        // (used to derive it) depends on `this.constraint`, matching
        // ParameterShapeNode's own constructor-ordering pattern.
        super(options.document, "", options.id ?? Id.generate());
        this.constraint = options.constraint;
        this.setPrivateValue("name", I18n.translate(this.display()));
    }

    override display(): I18nKeys {
        return DISPLAY_KEYS[this.constraint.kind] ?? "body.constraint.coincident";
    }

    override boundingBox(): BoundingBox | undefined {
        return undefined;
    }

    /** A generic passthrough to the wrapped constraint's own editable
     * dimensional value - `undefined` for every kind except `distance`,
     * since `SketchConstraintNode` wraps all constraint kinds through one
     * class (a `kind` discriminant, not per-kind subclasses), matching this
     * project's established rationale for that shape. Shown/edited in the
     * Properties panel like any other node property - editing it commits
     * through the same `Transaction`-joining path every property edit in
     * this app already uses (see `packages/ui/src/property/input.ts`), so
     * the value itself gets standard undo/redo for free. The resulting
     * geometry re-solve (triggered reactively elsewhere, see
     * `packages/three/src/sketchWorkerSolveCoordinator.ts`) is a separate,
     * later transaction - not yet folded into this one, since the solve
     * runs asynchronously in a worker and holding this transaction open
     * across that gap would risk colliding with any other edit the user
     * makes in the meantime. */
    @property("constraint.distance")
    get distance(): number | undefined {
        return this.constraint instanceof DistanceConstraint ? this.constraint.distance : undefined;
    }

    set distance(value: number) {
        if (!(this.constraint instanceof DistanceConstraint) || !Number.isFinite(value)) return;
        const oldValue = this.constraint.distance;
        if (oldValue === value) return;
        this.constraint.distance = value;
        Transaction.add(
            this.document,
            new PropertyHistoryRecord(this.constraint, "distance", oldValue, value),
        );
        this.emitPropertyChanged("distance", oldValue);
    }
}
