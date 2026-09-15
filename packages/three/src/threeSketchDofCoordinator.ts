// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    analyzeSketchDOF,
    type INode,
    isPropertyChanged,
    isSketchPointOwner,
    type NodeRecord,
    NodeUtils,
    SketchConstraintNode,
    type SketchDofStatus,
    type SketchGroupNode,
} from "@chili3d/core";
import { ThreeGeometry } from "./threeGeometry";
import type { ThreeVisualContext } from "./threeVisualContext";

/**
 * Recolors every entity in `sketch` by its live constraint status (see
 * `analyzeSketchDOF`) while it's the actively-edited sketch - one
 * coordinator per edit session (`ThreeVisualContext` owns its lifecycle,
 * keyed off `ModelManager.currentNode`), not one subscription per entity.
 * DOF status is inherently global to the whole sketch (any change can
 * shift any entity's color), so a single recompute per change is both
 * simpler and cheaper than each entity independently redoing the same
 * global Jacobian+null-space pass.
 */
export class ThreeSketchDofCoordinator {
    private listenedNodes = new Map<string, INode>();
    private recomputeScheduled = false;
    private disposed = false;

    constructor(
        private readonly context: ThreeVisualContext,
        private readonly sketch: SketchGroupNode,
    ) {
        this.context.visual.document.modelManager.addNodeObserver(this.handleDocumentNodesChanged);
        this.resubscribe();
        this.scheduleRecompute();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.context.visual.document.modelManager.removeNodeObserver(this.handleDocumentNodesChanged);
        for (const node of this.listenedNodes.values()) {
            if (isPropertyChanged(node)) node.removePropertyChanged(this.handleNodePropertyChanged);
        }
        this.paintAll(undefined); // back to normal colors once editing ends - before clearing, which paintAll reads from
        this.listenedNodes.clear();
    }

    private readonly handleDocumentNodesChanged = (records: NodeRecord[]) => {
        if (!records.some((r) => this.recordTouchesSketch(r))) return;
        this.resubscribe();
        this.scheduleRecompute();
    };

    /** A moved/added node's current parent chain covers add/insert/move;
     * `oldParent`/`newParent` cover remove (whose `node.parent` is already
     * nulled out by the time this event fires) - entities and constraint
     * nodes are always added directly under their `SketchGroupNode`, so a
     * direct-parent check is enough, no deeper ancestry walk needed. */
    private recordTouchesSketch(record: NodeRecord): boolean {
        return (
            this.isDescendantOrSelf(record.node) ||
            record.oldParent === this.sketch ||
            record.newParent === this.sketch
        );
    }

    private isDescendantOrSelf(node: INode): boolean {
        for (let n: INode | undefined = node; n; n = n.parent) if (n === this.sketch) return true;
        return false;
    }

    private resubscribe(): void {
        const owners = NodeUtils.findNodes(this.sketch, isSketchPointOwner);
        const constraintNodes = NodeUtils.findNodes(this.sketch, (n) => n instanceof SketchConstraintNode);
        const wanted = new Map<string, INode>();
        for (const node of [...owners, ...constraintNodes]) wanted.set(node.id, node);

        for (const [id, node] of this.listenedNodes) {
            if (!wanted.has(id) && isPropertyChanged(node)) {
                node.removePropertyChanged(this.handleNodePropertyChanged);
            }
        }
        for (const [id, node] of wanted) {
            if (!this.listenedNodes.has(id) && isPropertyChanged(node)) {
                node.onPropertyChanged(this.handleNodePropertyChanged);
            }
        }
        this.listenedNodes = wanted;
    }

    private readonly handleNodePropertyChanged = () => this.scheduleRecompute();

    /** Coalesce a burst of writes (e.g. every point a solve's `apply()`
     * writes fires its own propertyChanged) into a single recompute. */
    private scheduleRecompute(): void {
        if (this.recomputeScheduled || this.disposed) return;
        this.recomputeScheduled = true;
        queueMicrotask(() => {
            this.recomputeScheduled = false;
            if (this.disposed) return;
            this.paintAll(analyzeSketchDOF(this.sketch));
        });
    }

    private paintAll(statusMap: Map<string, SketchDofStatus> | undefined): void {
        for (const node of this.listenedNodes.values()) {
            if (!isSketchPointOwner(node)) continue;
            const visual = this.context.getVisual(node);
            if (visual instanceof ThreeGeometry) visual.setDofStatus(statusMap?.get(node.id));
        }
        this.context.visual.update();
    }
}
