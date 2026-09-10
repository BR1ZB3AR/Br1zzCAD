// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/** Flattened [x0, y0, x1, y1, ...] - every sketch point is a 2D (u, v) pair
 * in some plane-local coordinate system; the solver itself has no idea
 * what the numbers mean, only that there are `unknowns.length` of them. */
export type Unknowns = Float64Array;

/** Zero when the constraint it represents is satisfied at `u`. */
export type Residual = (u: Unknowns) => number;

export interface SolveOptions {
    maxIterations?: number;
    /** Converged once the residual vector's norm drops below this. */
    tolerance?: number;
    /** Step size for the numerical (finite-difference) Jacobian. */
    fdEpsilon?: number;
    lambdaInit?: number;
}

export type SolveStatus = "converged" | "maxIterationsReached" | "singular";

export interface SolveResult {
    status: SolveStatus;
    /** Best solution found so far - valid (and usually close) even when
     * `status` isn't "converged", but the caller decides whether a
     * non-converged result is still worth writing back anywhere. */
    unknowns: Unknowns;
    iterations: number;
    finalResidualNorm: number;
}

const DEFAULT_OPTIONS: Required<SolveOptions> = {
    maxIterations: 50,
    tolerance: 1e-9,
    fdEpsilon: 1e-7,
    lambdaInit: 1e-3,
};

const LAMBDA_CEILING = 1e12;
const MAX_STEP_ATTEMPTS = 20;

/**
 * Solves a (possibly non-square, possibly redundant) system of nonlinear
 * constraint residuals for the unknowns that make them all ~zero, via
 * Levenberg-Marquardt over Gauss-Newton normal equations. The Jacobian is
 * computed by central finite differences rather than per-constraint
 * analytic derivatives - this keeps every constraint's own implementation
 * down to just its residual equation (see `sketchConstraint.ts`), at the
 * cost of one extra residual evaluation per unknown per iteration, which is
 * negligible at sketch-sized problems (tens, not thousands, of unknowns).
 *
 * Never throws: an unsolvable/singular/non-converging system is reported
 * via `SolveResult.status`, not an exception, so a caller can decide what
 * to do (e.g. leave the sketch untouched and toast an error) rather than
 * having a bad user-drawn sketch crash the solver.
 */
export function solve(initial: Unknowns, residuals: Residual[], options?: SolveOptions): SolveResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const n = initial.length;
    const m = residuals.length;

    let x = Float64Array.from(initial);
    if (m === 0 || n === 0) {
        return { status: "converged", unknowns: x, iterations: 0, finalResidualNorm: 0 };
    }

    let lambda = opts.lambdaInit;
    let r = evaluateResiduals(residuals, x);
    let residualNormSq = dot(r, r);

    for (let iteration = 0; iteration < opts.maxIterations; iteration++) {
        if (Math.sqrt(residualNormSq) < opts.tolerance) {
            return {
                status: "converged",
                unknowns: x,
                iterations: iteration,
                finalResidualNorm: Math.sqrt(residualNormSq),
            };
        }

        const jacobian = numericJacobian(residuals, x, opts.fdEpsilon);
        const jtj = multiplyJtJ(jacobian, m, n);
        const jtr = multiplyJtR(jacobian, r, m, n);

        let stepAccepted = false;
        for (let attempt = 0; attempt < MAX_STEP_ATTEMPTS && !stepAccepted; attempt++) {
            const normalMatrix = withDampedDiagonal(jtj, n, lambda);
            const negJtr = jtr.map((v) => -v);
            const delta = solveLinearSystem(normalMatrix, negJtr, n);

            if (delta === undefined) {
                lambda *= 10;
                if (lambda > LAMBDA_CEILING) break;
                continue;
            }

            const xTry = x.map((v, i) => v + delta[i]);
            const rTry = evaluateResiduals(residuals, xTry);
            const normSqTry = dot(rTry, rTry);

            if (normSqTry < residualNormSq) {
                x = xTry;
                r = rTry;
                residualNormSq = normSqTry;
                lambda = Math.max(lambda / 10, 1e-12);
                stepAccepted = true;
            } else {
                lambda *= 10;
                if (lambda > LAMBDA_CEILING) break;
            }
        }

        if (!stepAccepted) {
            return {
                status: "singular",
                unknowns: x,
                iterations: iteration,
                finalResidualNorm: Math.sqrt(residualNormSq),
            };
        }
    }

    return {
        status: "maxIterationsReached",
        unknowns: x,
        iterations: opts.maxIterations,
        finalResidualNorm: Math.sqrt(residualNormSq),
    };
}

function evaluateResiduals(residuals: Residual[], u: Unknowns): Float64Array {
    const r = new Float64Array(residuals.length);
    for (let i = 0; i < residuals.length; i++) r[i] = residuals[i](u);
    return r;
}

/** Row-major m*n: jacobian[i*n+j] = d(residual_i)/d(unknown_j), via central
 * finite differences (two residual evaluations per unknown). */
function numericJacobian(residuals: Residual[], x: Unknowns, epsilon: number): Float64Array {
    const n = x.length;
    const m = residuals.length;
    const jacobian = new Float64Array(m * n);
    const perturbed = Float64Array.from(x);

    for (let j = 0; j < n; j++) {
        const original = perturbed[j];
        perturbed[j] = original + epsilon;
        const rPlus = evaluateResiduals(residuals, perturbed);
        perturbed[j] = original - epsilon;
        const rMinus = evaluateResiduals(residuals, perturbed);
        perturbed[j] = original;

        for (let i = 0; i < m; i++) {
            jacobian[i * n + j] = (rPlus[i] - rMinus[i]) / (2 * epsilon);
        }
    }
    return jacobian;
}

/** n*n row-major: JᵀJ. */
function multiplyJtJ(jacobian: Float64Array, m: number, n: number): Float64Array {
    const result = new Float64Array(n * n);
    for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
            let sum = 0;
            for (let i = 0; i < m; i++) {
                sum += jacobian[i * n + a] * jacobian[i * n + b];
            }
            result[a * n + b] = sum;
        }
    }
    return result;
}

/** length n: Jᵀr. */
function multiplyJtR(jacobian: Float64Array, r: Float64Array, m: number, n: number): Float64Array {
    const result = new Float64Array(n);
    for (let a = 0; a < n; a++) {
        let sum = 0;
        for (let i = 0; i < m; i++) {
            sum += jacobian[i * n + a] * r[i];
        }
        result[a] = sum;
    }
    return result;
}

/** Classic Marquardt damping (`lambda * diag(JtJ)`) leaves an unknown that
 * has zero effect on every residual completely unregularized (its diagonal
 * entry is 0, so `lambda * 0` adds nothing), which would report the whole
 * system "singular" just because one unrelated unknown is untouched. A
 * small floor keeps that direction solvable (as a no-op step) without
 * masking genuine rank deficiency elsewhere in the system. */
function withDampedDiagonal(matrix: Float64Array, n: number, lambda: number): Float64Array {
    const result = Float64Array.from(matrix);
    for (let i = 0; i < n; i++) {
        result[i * n + i] += lambda * Math.max(matrix[i * n + i], 1e-10);
    }
    return result;
}

function dot(a: Float64Array, b: Float64Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

/** Solves `matrix * x = rhs` (n*n row-major `matrix`) via Gaussian
 * elimination with partial pivoting. Returns undefined if `matrix` is
 * (numerically) singular, rather than dividing by ~zero. */
function solveLinearSystem(matrix: Float64Array, rhs: Float64Array, n: number): Float64Array | undefined {
    const a = Float64Array.from(matrix);
    const b = Float64Array.from(rhs);

    for (let col = 0; col < n; col++) {
        let pivotRow = col;
        let pivotValue = Math.abs(a[col * n + col]);
        for (let row = col + 1; row < n; row++) {
            const value = Math.abs(a[row * n + col]);
            if (value > pivotValue) {
                pivotValue = value;
                pivotRow = row;
            }
        }

        if (pivotValue < 1e-14) return undefined;

        if (pivotRow !== col) {
            for (let k = 0; k < n; k++) {
                const tmp = a[col * n + k];
                a[col * n + k] = a[pivotRow * n + k];
                a[pivotRow * n + k] = tmp;
            }
            const tmpB = b[col];
            b[col] = b[pivotRow];
            b[pivotRow] = tmpB;
        }

        for (let row = col + 1; row < n; row++) {
            const factor = a[row * n + col] / a[col * n + col];
            if (factor === 0) continue;
            for (let k = col; k < n; k++) {
                a[row * n + k] -= factor * a[col * n + k];
            }
            b[row] -= factor * b[col];
        }
    }

    const x = new Float64Array(n);
    for (let row = n - 1; row >= 0; row--) {
        let sum = b[row];
        for (let k = row + 1; k < n; k++) sum -= a[row * n + k] * x[k];
        x[row] = sum / a[row * n + row];
    }
    return x;
}
