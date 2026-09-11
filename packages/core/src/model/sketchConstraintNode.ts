// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument } from "../document";
import { Id } from "../foundation";
import { I18n, type I18nKeys } from "../i18n";
import type { BoundingBox } from "../math";
import { serializable, serialize } from "../serialize";
import type { SketchConstraint } from "./sketchConstraint";
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
}
