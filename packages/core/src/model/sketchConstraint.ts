// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Id } from "../foundation";
import { serializable, serialize } from "../serialize";
import type { Residual } from "../sketchSolver";
import type { SketchPointHandle } from "./sketchPointOwner";

/** Maps a point handle to its (u, v) pair's offset into the solver's flat
 * unknowns array - `u[index(handle)]` is the u coordinate, `u[index(handle)
 * + 1]` the v coordinate. Assigned by `sketchSolverRunner`, not the
 * constraint itself, since the same handle may be shared by several
 * constraints and must resolve to the same offset in all of them. */
export type UnknownIndex = (handle: SketchPointHandle) => number;

export interface SketchConstraintOptions {
    id?: string;
}

/**
 * A stored, persistent geometric relationship between sketch points (see
 * `SketchGroupNode.constraints`) - re-applied by `sketchSolverRunner`
 * whenever the sketch is (re)solved, not a one-time alignment. Each kind is
 * its own small `@serializable()` class (not a discriminated union): the
 * `Serializer`'s class registry already round-trips a polymorphic array of
 * registered classes with zero extra plumbing (see `FaceMaterialPair` for
 * the existing precedent), which a hand-rolled union would need a manual
 * kind-switch bolted onto deserialization to match.
 */
export abstract class SketchConstraint {
    @serialize()
    readonly id: string;

    abstract readonly kind: string;

    constructor(options?: SketchConstraintOptions) {
        this.id = options?.id ?? Id.generate();
    }

    /** Every point this constraint references - used by the runner to
     * discover which points need to become solver unknowns. */
    abstract handles(): readonly SketchPointHandle[];

    /** Zero or more residual functions (see `sketchSolver/solver.ts`) whose
     * combined root is this constraint being satisfied. */
    abstract residuals(index: UnknownIndex): Residual[];
}

export interface CoincidentConstraintOptions extends SketchConstraintOptions {
    p1: SketchPointHandle;
    p2: SketchPointHandle;
}

/** Forces two points to the same location. */
@serializable()
export class CoincidentConstraint extends SketchConstraint {
    readonly kind = "coincident";

    @serialize()
    readonly p1: SketchPointHandle;
    @serialize()
    readonly p2: SketchPointHandle;

    constructor(options: CoincidentConstraintOptions) {
        super(options);
        this.p1 = options.p1;
        this.p2 = options.p2;
    }

    handles(): readonly SketchPointHandle[] {
        return [this.p1, this.p2];
    }

    residuals(index: UnknownIndex): Residual[] {
        const i1 = index(this.p1);
        const i2 = index(this.p2);
        return [(u) => u[i1] - u[i2], (u) => u[i1 + 1] - u[i2 + 1]];
    }
}

export interface HorizontalConstraintOptions extends SketchConstraintOptions {
    p1: SketchPointHandle;
    p2: SketchPointHandle;
}

/** Forces the segment p1-p2 to run parallel to the sketch plane's own u
 * axis (equal v/"y" coordinate in plane-local space). */
@serializable()
export class HorizontalConstraint extends SketchConstraint {
    readonly kind = "horizontal";

    @serialize()
    readonly p1: SketchPointHandle;
    @serialize()
    readonly p2: SketchPointHandle;

    constructor(options: HorizontalConstraintOptions) {
        super(options);
        this.p1 = options.p1;
        this.p2 = options.p2;
    }

    handles(): readonly SketchPointHandle[] {
        return [this.p1, this.p2];
    }

    residuals(index: UnknownIndex): Residual[] {
        const i1 = index(this.p1);
        const i2 = index(this.p2);
        return [(u) => u[i1 + 1] - u[i2 + 1]];
    }
}

export interface VerticalConstraintOptions extends SketchConstraintOptions {
    p1: SketchPointHandle;
    p2: SketchPointHandle;
}

/** Forces the segment p1-p2 to run parallel to the sketch plane's own v
 * axis (equal u/"x" coordinate in plane-local space). */
@serializable()
export class VerticalConstraint extends SketchConstraint {
    readonly kind = "vertical";

    @serialize()
    readonly p1: SketchPointHandle;
    @serialize()
    readonly p2: SketchPointHandle;

    constructor(options: VerticalConstraintOptions) {
        super(options);
        this.p1 = options.p1;
        this.p2 = options.p2;
    }

    handles(): readonly SketchPointHandle[] {
        return [this.p1, this.p2];
    }

    residuals(index: UnknownIndex): Residual[] {
        const i1 = index(this.p1);
        const i2 = index(this.p2);
        return [(u) => u[i1] - u[i2]];
    }
}

export interface ParallelConstraintOptions extends SketchConstraintOptions {
    a1: SketchPointHandle;
    a2: SketchPointHandle;
    b1: SketchPointHandle;
    b2: SketchPointHandle;
}

/** Forces segment a1-a2 and segment b1-b2 to the same direction (their 2D
 * cross product is zero). */
@serializable()
export class ParallelConstraint extends SketchConstraint {
    readonly kind = "parallel";

    @serialize()
    readonly a1: SketchPointHandle;
    @serialize()
    readonly a2: SketchPointHandle;
    @serialize()
    readonly b1: SketchPointHandle;
    @serialize()
    readonly b2: SketchPointHandle;

    constructor(options: ParallelConstraintOptions) {
        super(options);
        this.a1 = options.a1;
        this.a2 = options.a2;
        this.b1 = options.b1;
        this.b2 = options.b2;
    }

    handles(): readonly SketchPointHandle[] {
        return [this.a1, this.a2, this.b1, this.b2];
    }

    residuals(index: UnknownIndex): Residual[] {
        const ia1 = index(this.a1);
        const ia2 = index(this.a2);
        const ib1 = index(this.b1);
        const ib2 = index(this.b2);
        return [
            (u) => {
                const ax = u[ia2] - u[ia1];
                const ay = u[ia2 + 1] - u[ia1 + 1];
                const bx = u[ib2] - u[ib1];
                const by = u[ib2 + 1] - u[ib1 + 1];
                return ax * by - ay * bx;
            },
        ];
    }
}

export interface PerpendicularConstraintOptions extends SketchConstraintOptions {
    a1: SketchPointHandle;
    a2: SketchPointHandle;
    b1: SketchPointHandle;
    b2: SketchPointHandle;
}

/** Forces segment a1-a2 and segment b1-b2 to a 90-degree angle (their dot
 * product is zero). */
@serializable()
export class PerpendicularConstraint extends SketchConstraint {
    readonly kind = "perpendicular";

    @serialize()
    readonly a1: SketchPointHandle;
    @serialize()
    readonly a2: SketchPointHandle;
    @serialize()
    readonly b1: SketchPointHandle;
    @serialize()
    readonly b2: SketchPointHandle;

    constructor(options: PerpendicularConstraintOptions) {
        super(options);
        this.a1 = options.a1;
        this.a2 = options.a2;
        this.b1 = options.b1;
        this.b2 = options.b2;
    }

    handles(): readonly SketchPointHandle[] {
        return [this.a1, this.a2, this.b1, this.b2];
    }

    residuals(index: UnknownIndex): Residual[] {
        const ia1 = index(this.a1);
        const ia2 = index(this.a2);
        const ib1 = index(this.b1);
        const ib2 = index(this.b2);
        return [
            (u) => {
                const ax = u[ia2] - u[ia1];
                const ay = u[ia2 + 1] - u[ia1 + 1];
                const bx = u[ib2] - u[ib1];
                const by = u[ib2 + 1] - u[ib1 + 1];
                return ax * bx + ay * by;
            },
        ];
    }
}

export interface EqualConstraintOptions extends SketchConstraintOptions {
    a1: SketchPointHandle;
    a2: SketchPointHandle;
    b1: SketchPointHandle;
    b2: SketchPointHandle;
}

/** Forces segment a1-a2 and segment b1-b2 to the same length. */
@serializable()
export class EqualConstraint extends SketchConstraint {
    readonly kind = "equal";

    @serialize()
    readonly a1: SketchPointHandle;
    @serialize()
    readonly a2: SketchPointHandle;
    @serialize()
    readonly b1: SketchPointHandle;
    @serialize()
    readonly b2: SketchPointHandle;

    constructor(options: EqualConstraintOptions) {
        super(options);
        this.a1 = options.a1;
        this.a2 = options.a2;
        this.b1 = options.b1;
        this.b2 = options.b2;
    }

    handles(): readonly SketchPointHandle[] {
        return [this.a1, this.a2, this.b1, this.b2];
    }

    residuals(index: UnknownIndex): Residual[] {
        const ia1 = index(this.a1);
        const ia2 = index(this.a2);
        const ib1 = index(this.b1);
        const ib2 = index(this.b2);
        return [
            (u) => {
                const ax = u[ia2] - u[ia1];
                const ay = u[ia2 + 1] - u[ia1 + 1];
                const bx = u[ib2] - u[ib1];
                const by = u[ib2 + 1] - u[ib1 + 1];
                return Math.sqrt(ax * ax + ay * ay) - Math.sqrt(bx * bx + by * by);
            },
        ];
    }
}
