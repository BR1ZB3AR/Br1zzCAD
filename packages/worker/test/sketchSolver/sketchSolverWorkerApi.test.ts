// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { CoincidentConstraint, FixedConstraint, Serializer, SketchPointHandle } from "@chili3d/core";
import { solveSketchInWorker } from "../../src/sketchSolver/sketchSolverWorkerApi";

describe("solveSketchInWorker", () => {
    test("deserializes real constraints and solves a coincident pair, matching the main-thread solver", () => {
        const p1 = new SketchPointHandle({ nodeId: "a", role: "p" });
        const p2 = new SketchPointHandle({ nodeId: "b", role: "p" });
        const constraint = new CoincidentConstraint({ p1, p2 });

        const offsets = new Map([
            ["a:p", 0],
            ["b:p", 2],
        ]);
        const result = solveSketchInWorker({
            initial: new Float64Array([0, 0, 10, 10]),
            constraints: [Serializer.serializeObject(constraint)],
            offsets,
            hasParameterizedOwner: false,
        });

        expect(result.rejected).toBeFalsy();
        if (result.rejected) return;
        expect(result.status).toBe("converged");
        expect(result.unknowns[0]).toBeCloseTo(result.unknowns[2], 5);
        expect(result.unknowns[1]).toBeCloseTo(result.unknowns[3], 5);
    });

    test("solves a Fixed constraint by pinning the point to its target", () => {
        const p1 = new SketchPointHandle({ nodeId: "a", role: "p" });
        const constraint = new FixedConstraint({ p1, u: 7, v: -3 });

        const result = solveSketchInWorker({
            initial: new Float64Array([0, 0]),
            constraints: [Serializer.serializeObject(constraint)],
            offsets: new Map([["a:p", 0]]),
            hasParameterizedOwner: false,
        });

        expect(result.rejected).toBeFalsy();
        if (result.rejected) return;
        expect(result.status).toBe("converged");
        expect(result.unknowns[0]).toBeCloseTo(7, 5);
        expect(result.unknowns[1]).toBeCloseTo(-3, 5);
    });

    test("rejects cleanly (does not silently solve) when the sketch has a parameterized owner", () => {
        const result = solveSketchInWorker({
            initial: new Float64Array([0, 0]),
            constraints: [],
            offsets: new Map(),
            hasParameterizedOwner: true,
        });

        expect(result.rejected).toBe(true);
        if (!result.rejected) return;
        expect(result.reason).toContain("parameterized owner");
    });

    test("solves trivially with no constraints", () => {
        const result = solveSketchInWorker({
            initial: new Float64Array([1, 2]),
            constraints: [],
            offsets: new Map(),
            hasParameterizedOwner: false,
        });

        expect(result.rejected).toBeFalsy();
        if (result.rejected) return;
        expect(result.status).toBe("converged");
        expect(result.finalResidualNorm).toBe(0);
    });
});
