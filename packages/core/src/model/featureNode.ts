// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { SketchSolveOutcome } from "./sketchSolverRunner";

/**
 * A node in the document's parametric feature tree - the first step of
 * migrating away from a flat, feature-unaware node tree toward one where
 * geometry is explicitly derived from named parameters and can be
 * recomputed on demand. `SketchGroupNode` is the first (and, for now,
 * only) implementer - see its `compute()`/`dependencies`.
 */
export interface IFeatureNode {
    readonly id: string;
    readonly name: string;
    /** Other features this one's geometry depends on. Always empty for a
     * `SketchGroupNode` today - nothing in this app has cross-feature
     * dependencies yet (no Extrude-depends-on-Sketch relationship exists).
     * Present as forward-compatible scaffolding for when non-sketch
     * features are introduced - the DAG is genuinely a graph of one node
     * kind today, not a full dependency graph in practice yet. */
    readonly dependencies: readonly IFeatureNode[];
    /** Recomputes this feature's geometry from its current parameters. */
    compute(): SketchSolveOutcome;
}
