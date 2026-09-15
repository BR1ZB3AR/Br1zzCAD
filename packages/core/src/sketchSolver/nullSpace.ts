// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Basis (linearly independent, not necessarily orthonormal) for the null
 * space of symmetric n*n row-major `matrix` - intended for `JᵀJ`, whose null
 * space equals the constraint Jacobian `J`'s own null space (`‖Jv‖² =
 * vᵀJᵀJv`, so `Jv=0 ⟺ JᵀJv=0`), needed to tell which directions a sketch
 * can still flex in without violating any constraint.
 *
 * Computed via Gaussian elimination to reduced row-echelon form rather than
 * an eigendecomposition: nothing downstream needs ordered eigenvalues, only
 * which columns end up without a pivot (free = a genuine direction of
 * freedom), so this is a direct extension of the same elimination style
 * `solver.ts`'s `solveLinearSystem` already uses, not a new algorithm.
 */
export function nullSpaceOfSymmetric(
    matrix: Float64Array,
    n: number,
    relativeTolerance = 1e-7,
): Float64Array[] {
    const a = Float64Array.from(matrix);

    let maxDiag = 0;
    for (let i = 0; i < n; i++) maxDiag = Math.max(maxDiag, Math.abs(a[i * n + i]));
    const tolerance = Math.max(maxDiag, 1) * relativeTolerance;

    const pivotCols: number[] = [];
    let pivotRowIndex = 0;

    for (let col = 0; col < n && pivotRowIndex < n; col++) {
        let bestRow = pivotRowIndex;
        let bestValue = Math.abs(a[pivotRowIndex * n + col]);
        for (let row = pivotRowIndex + 1; row < n; row++) {
            const value = Math.abs(a[row * n + col]);
            if (value > bestValue) {
                bestValue = value;
                bestRow = row;
            }
        }
        if (bestValue < tolerance) continue; // no pivot in this column: it's free

        if (bestRow !== pivotRowIndex) swapRows(a, pivotRowIndex, bestRow, n);

        const pivot = a[pivotRowIndex * n + col];
        for (let k = 0; k < n; k++) a[pivotRowIndex * n + k] /= pivot;

        for (let row = 0; row < n; row++) {
            if (row === pivotRowIndex) continue;
            const factor = a[row * n + col];
            if (factor === 0) continue;
            for (let k = 0; k < n; k++) a[row * n + k] -= factor * a[pivotRowIndex * n + k];
        }

        pivotCols.push(col);
        pivotRowIndex++;
    }

    const pivotSet = new Set(pivotCols);
    const freeCols: number[] = [];
    for (let col = 0; col < n; col++) if (!pivotSet.has(col)) freeCols.push(col);

    // Standard RREF null-space construction: for each free column, set it
    // to 1 and every other free column to 0, then read each pivot row's
    // (negated) coefficient on that free column as the pivot variable's
    // value - `a` is already in reduced row-echelon form at this point, so
    // row `i` of `a` reads directly as `pivotVar[i] + sum(freeCoeff * freeVar) = 0`.
    return freeCols.map((freeCol) => {
        const vector = new Float64Array(n);
        vector[freeCol] = 1;
        for (let i = 0; i < pivotCols.length; i++) {
            vector[pivotCols[i]] = -a[i * n + freeCol];
        }
        return vector;
    });
}

function swapRows(a: Float64Array, r1: number, r2: number, n: number) {
    for (let k = 0; k < n; k++) {
        const tmp = a[r1 * n + k];
        a[r1 * n + k] = a[r2 * n + k];
        a[r2 * n + k] = tmp;
    }
}
