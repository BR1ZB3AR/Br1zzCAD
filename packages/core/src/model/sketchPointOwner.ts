// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { XYZ } from "../math";
import { serializable, serialize } from "../serialize";

export interface SketchPointHandleOptions {
    nodeId: string;
    role: string;
}

/** Identifies one constrainable point of one sketch shape - `role` is a
 * stable, node-type-specific id (e.g. "start"/"end" for a line,
 * "corner0".."corner3" for a rect), not a shape sub-index, since a node's
 * own points aren't shared/topological objects (see `ISketchPointOwner`).
 * A small `@serializable()` class (not a plain interface/object literal) -
 * `Serializer` only round-trips a nested object value through a registered
 * class, matching how `Plane`'s `origin`/`xvec` fields are `XYZ` instances
 * rather than plain `{x,y,z}` objects. */
@serializable()
export class SketchPointHandle {
    @serialize()
    readonly nodeId: string;
    @serialize()
    readonly role: string;

    constructor(options: SketchPointHandleOptions) {
        this.nodeId = options.nodeId;
        this.role = options.role;
    }
}

/**
 * Implemented by a sketch shape node that exposes one or more of its own
 * points as targets for geometric constraints (Coincident, Horizontal, ...).
 * Every sketch shape stores its geometry as independent plain fields (a
 * line's `start`/`end`, say) rather than shared vertex objects, so there's
 * no single "the point" to hand a constraint solver a reference to -
 * instead, a node exposes stable `role` ids and get/set accessors for each.
 *
 * `setSketchPoint` is a best-effort inverse, not a strict setter: a node's
 * own parameterization may not have enough freedom to place a point at
 * exactly the requested location (e.g. a rect corner can only move along
 * its own two edges, since the other two corners are derived from the same
 * `dx`/`dy`) - it should get as close as that parameterization allows and
 * let `getSketchPoint` report where the point actually ended up. The
 * solver only ever reads that back, so this never desyncs it.
 */
export interface ISketchPointOwner {
    sketchPointRoles(): readonly string[];
    getSketchPoint(role: string): XYZ | undefined;
    setSketchPoint(role: string, point: XYZ): void;
}

export function isSketchPointOwner(value: unknown): value is ISketchPointOwner {
    const candidate = value as Partial<ISketchPointOwner> | null | undefined;
    return (
        !!candidate &&
        typeof candidate.sketchPointRoles === "function" &&
        typeof candidate.getSketchPoint === "function" &&
        typeof candidate.setSketchPoint === "function"
    );
}
