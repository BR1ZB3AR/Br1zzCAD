// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { solve } from "../../src/sketchSolver/solver";

describe("sketchSolver.solve", () => {
    test("converges instantly when there are no residuals", () => {
        const initial = new Float64Array([1, 2, 3]);
        const result = solve(initial, []);

        expect(result.status).toBe("converged");
        expect(result.iterations).toBe(0);
        expect(result.finalResidualNorm).toBe(0);
        expect(Array.from(result.unknowns)).toEqual([1, 2, 3]);
    });

    test("solves a single unknown against a linear residual", () => {
        const initial = new Float64Array([0]);
        const result = solve(initial, [(u) => u[0] - 5]);

        expect(result.status).toBe("converged");
        expect(result.unknowns[0]).toBeCloseTo(5, 6);
    });

    test("solves an exactly-determined 2-unknown system (point on the x-axis at distance 5)", () => {
        const initial = new Float64Array([1, 1]);
        const result = solve(initial, [
            (u) => u[1], // y == 0
            (u) => Math.sqrt(u[0] * u[0] + u[1] * u[1]) - 5, // distance from origin == 5
        ]);

        expect(result.status).toBe("converged");
        expect(result.unknowns[0]).toBeCloseTo(5, 5);
        expect(result.unknowns[1]).toBeCloseTo(0, 5);
    });

    test("solves a coincident-style system (point1 pinned, point0 forced to match it)", () => {
        // Mirrors CoincidentConstraint's residual shape: p0.x - p1.x, p0.y - p1.y.
        const initial = new Float64Array([0, 0, 3, 4]);
        const result = solve(initial, [
            (u) => u[0] - 3, // pin point1.x
            (u) => u[1] - 4, // pin point1.y
            (u) => u[0] - u[2], // point0.x == point1.x
            (u) => u[1] - u[3], // point0.y == point1.y
        ]);

        expect(result.status).toBe("converged");
        expect(result.unknowns[0]).toBeCloseTo(3, 5);
        expect(result.unknowns[1]).toBeCloseTo(4, 5);
        expect(result.unknowns[2]).toBeCloseTo(3, 5);
        expect(result.unknowns[3]).toBeCloseTo(4, 5);
    });

    test("does not report convergence for a provably conflicting system", () => {
        // Both residuals depend only on distance-from-origin but target
        // different values (5 vs 10) - no (x, y) satisfies both at once.
        const initial = new Float64Array([1, 1]);
        const result = solve(initial, [
            (u) => Math.sqrt(u[0] * u[0] + u[1] * u[1]) - 5,
            (u) => Math.sqrt(u[0] * u[0] + u[1] * u[1]) - 10,
        ]);

        expect(result.status).not.toBe("converged");
        expect(result.iterations).toBeLessThanOrEqual(50);
        expect(result.finalResidualNorm).toBeGreaterThan(1);
    });

    test("terminates within a caller-provided iteration budget instead of over-solving", () => {
        // (1, 1), not (0, 0) - starting exactly at the origin is a genuinely
        // singular configuration for a distance-from-origin residual (its
        // gradient direction is undefined there), which isn't what this
        // test is about; it's about the iteration budget being honored.
        const initial = new Float64Array([1, 1]);
        const result = solve(initial, [(u) => u[1], (u) => Math.sqrt(u[0] * u[0] + u[1] * u[1]) - 5], {
            maxIterations: 1,
        });

        expect(result.iterations).toBeLessThanOrEqual(1);
        expect(["converged", "maxIterationsReached", "singular"]).toContain(result.status);
    });

    test("does not mutate the caller's initial unknowns array", () => {
        const initial = new Float64Array([0]);
        solve(initial, [(u) => u[0] - 5]);

        expect(Array.from(initial)).toEqual([0]);
    });

    test("an unknown with zero effect on any residual still lets the rest of the system converge", () => {
        // Regression case for LM damping: a residual set that never
        // references unknowns[1] must not make the whole solve report
        // failure just because that one direction is unconstrained.
        const initial = new Float64Array([0, 42]);
        const result = solve(initial, [(u) => u[0] - 5]);

        expect(result.unknowns[0]).toBeCloseTo(5, 5);
        expect(result.unknowns[1]).toBeCloseTo(42, 6);
    });
});
