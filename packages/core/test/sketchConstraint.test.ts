// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    EqualConstraint,
    HorizontalConstraint,
    InternalClassName,
    ParallelConstraint,
    PerpendicularConstraint,
    Serializer,
    SketchPointHandle,
    VerticalConstraint,
} from "../src";
import type { UnknownIndex } from "../src/model/sketchConstraint";

const p1 = new SketchPointHandle({ nodeId: "line1", role: "start" });
const p2 = new SketchPointHandle({ nodeId: "line1", role: "end" });
const a1 = new SketchPointHandle({ nodeId: "lineA", role: "start" });
const a2 = new SketchPointHandle({ nodeId: "lineA", role: "end" });
const b1 = new SketchPointHandle({ nodeId: "lineB", role: "start" });
const b2 = new SketchPointHandle({ nodeId: "lineB", role: "end" });

/** p1/p2 at offsets 0/2, a1/a2 at 4/6, b1/b2 at 8/10 - fixed for every test
 * below so a single flat unknowns array can exercise any constraint kind. */
const index: UnknownIndex = (handle) => {
    const offsets: Record<string, number> = {
        "line1:start": 0,
        "line1:end": 2,
        "lineA:start": 4,
        "lineA:end": 6,
        "lineB:start": 8,
        "lineB:end": 10,
    };
    return offsets[`${handle.nodeId}:${handle.role}`];
};

function sumAbs(residuals: ReturnType<VerticalConstraint["residuals"]>, u: Float64Array): number {
    return residuals.reduce((sum, r) => sum + Math.abs(r(u)), 0);
}

describe("SketchConstraint kinds", () => {
    describe("CoincidentConstraint", () => {
        test("residuals are ~0 when the two points coincide", () => {
            const c = new CoincidentConstraint({ p1, p2 });
            const u = new Float64Array(4);
            u[0] = 3;
            u[1] = 4;
            u[2] = 3;
            u[3] = 4;
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(0, 9);
        });

        test("residuals are nonzero when the two points differ", () => {
            const c = new CoincidentConstraint({ p1, p2 });
            const u = new Float64Array(4);
            u[0] = 3;
            u[1] = 4;
            u[2] = 0;
            u[3] = 0;
            expect(sumAbs(c.residuals(index), u)).toBeGreaterThan(1);
        });

        test("handles() returns both points", () => {
            const c = new CoincidentConstraint({ p1, p2 });
            expect(c.handles()).toEqual([p1, p2]);
        });
    });

    describe("HorizontalConstraint", () => {
        test("residual is ~0 when v (y) coordinates match", () => {
            const c = new HorizontalConstraint({ p1, p2 });
            const u = new Float64Array(4);
            u[1] = 5;
            u[3] = 5;
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(0, 9);
        });

        test("residual is nonzero when v coordinates differ", () => {
            const c = new HorizontalConstraint({ p1, p2 });
            const u = new Float64Array(4);
            u[1] = 5;
            u[3] = 9;
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(4, 9);
        });
    });

    describe("VerticalConstraint", () => {
        test("residual is ~0 when u (x) coordinates match", () => {
            const c = new VerticalConstraint({ p1, p2 });
            const u = new Float64Array(4);
            u[0] = 7;
            u[2] = 7;
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(0, 9);
        });

        test("residual is nonzero when u coordinates differ", () => {
            const c = new VerticalConstraint({ p1, p2 });
            const u = new Float64Array(4);
            u[0] = 7;
            u[2] = 1;
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(6, 9);
        });
    });

    describe("ParallelConstraint", () => {
        test("residual is ~0 when both segments point the same direction", () => {
            const c = new ParallelConstraint({ a1, a2, b1, b2 });
            const u = new Float64Array(12);
            // segment A: (0,0) -> (2,0); segment B: (5,5) -> (9,5) - both horizontal
            u[4] = 0;
            u[5] = 0;
            u[6] = 2;
            u[7] = 0;
            u[8] = 5;
            u[9] = 5;
            u[10] = 9;
            u[11] = 5;
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(0, 9);
        });

        test("residual is nonzero when the segments cross at an angle", () => {
            const c = new ParallelConstraint({ a1, a2, b1, b2 });
            const u = new Float64Array(12);
            u[4] = 0;
            u[5] = 0;
            u[6] = 2;
            u[7] = 0; // A: horizontal
            u[8] = 0;
            u[9] = 0;
            u[10] = 0;
            u[11] = 2; // B: vertical
            expect(sumAbs(c.residuals(index), u)).toBeGreaterThan(1);
        });
    });

    describe("PerpendicularConstraint", () => {
        test("residual is ~0 when the segments meet at 90 degrees", () => {
            const c = new PerpendicularConstraint({ a1, a2, b1, b2 });
            const u = new Float64Array(12);
            u[4] = 0;
            u[5] = 0;
            u[6] = 2;
            u[7] = 0; // A: horizontal
            u[8] = 0;
            u[9] = 0;
            u[10] = 0;
            u[11] = 2; // B: vertical
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(0, 9);
        });

        test("residual is nonzero when the segments are parallel instead", () => {
            const c = new PerpendicularConstraint({ a1, a2, b1, b2 });
            const u = new Float64Array(12);
            u[4] = 0;
            u[5] = 0;
            u[6] = 2;
            u[7] = 0;
            u[8] = 5;
            u[9] = 5;
            u[10] = 9;
            u[11] = 5;
            expect(sumAbs(c.residuals(index), u)).toBeGreaterThan(1);
        });
    });

    describe("EqualConstraint", () => {
        test("residual is ~0 when both segments have the same length", () => {
            const c = new EqualConstraint({ a1, a2, b1, b2 });
            const u = new Float64Array(12);
            u[4] = 0;
            u[5] = 0;
            u[6] = 5;
            u[7] = 0; // A: length 5
            u[8] = 0;
            u[9] = 0;
            u[10] = 0;
            u[11] = 5; // B: length 5
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(0, 9);
        });

        test("residual equals the length difference when they differ", () => {
            const c = new EqualConstraint({ a1, a2, b1, b2 });
            const u = new Float64Array(12);
            u[4] = 0;
            u[5] = 0;
            u[6] = 5;
            u[7] = 0; // A: length 5
            u[8] = 0;
            u[9] = 0;
            u[10] = 0;
            u[11] = 8; // B: length 8
            expect(sumAbs(c.residuals(index), u)).toBeCloseTo(3, 9);
        });
    });
});

describe("SketchConstraint serialization", () => {
    test("SketchPointHandle round-trips through the class registry", () => {
        const original = new SketchPointHandle({ nodeId: "line1", role: "start" });
        const serialized = Serializer.serializeObject(original);
        expect(serialized[InternalClassName]).toBe("SketchPointHandle");

        const restored = Serializer.deserializeObject({} as any, serialized) as SketchPointHandle;
        expect(restored).toBeInstanceOf(SketchPointHandle);
        expect(restored.nodeId).toBe("line1");
        expect(restored.role).toBe("start");
    });

    test("a point-pair constraint (Coincident) round-trips with its nested handles intact", () => {
        const original = new CoincidentConstraint({ p1, p2 });
        const serialized = Serializer.serializeObject(original);
        expect(serialized[InternalClassName]).toBe("CoincidentConstraint");

        const restored = Serializer.deserializeObject({} as any, serialized) as CoincidentConstraint;
        expect(restored).toBeInstanceOf(CoincidentConstraint);
        expect(restored.id).toBe(original.id);
        expect(restored.p1).toBeInstanceOf(SketchPointHandle);
        expect(restored.p1.nodeId).toBe("line1");
        expect(restored.p1.role).toBe("start");
        expect(restored.p2.role).toBe("end");
    });

    test("a four-handle constraint (Perpendicular) round-trips polymorphically", () => {
        const original = new PerpendicularConstraint({ a1, a2, b1, b2 });
        const serialized = Serializer.serializeObject(original);

        const restored = Serializer.deserializeObject({} as any, serialized) as PerpendicularConstraint;
        expect(restored).toBeInstanceOf(PerpendicularConstraint);
        expect(restored.a1.nodeId).toBe("lineA");
        expect(restored.b2.role).toBe("end");
    });

    test("each constraint auto-generates a unique id when none is given", () => {
        const c1 = new CoincidentConstraint({ p1, p2 });
        const c2 = new CoincidentConstraint({ p1, p2 });
        expect(c1.id).not.toBe(c2.id);
        expect(typeof c1.id).toBe("string");
        expect(c1.id.length).toBeGreaterThan(0);
    });
});
