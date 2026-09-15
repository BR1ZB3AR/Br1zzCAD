// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type INode,
    isPropertyChanged,
    type NodeRecord,
    NodeUtils,
    PubSub,
    SketchConstraintNode,
    type SketchGroupNode,
} from "@chili3d/core";
import { resolveSketchViaWorker, type SketchSolveSession } from "@chili3d/worker";
import type { ThreeVisualContext } from "./threeVisualContext";

/**
 * Reacts to a sketch's `SketchConstraintNode.distance` edits (see its own
 * doc - the Properties panel already gives that value's own undo/redo for
 * free) by dispatching a full sketch resolve to the shared Web Worker
 * session, then writing the converged geometry back into the live document.
 *
 * One coordinator per actively-edited sketch (`ThreeVisualContext` owns its
 * lifecycle, keyed off `ModelManager.currentNode`, mirroring
 * `ThreeSketchDofCoordinator`'s exact shape) - but the `SketchSolveSession`/
 * underlying `Worker` itself is shared and long-lived (owned by
 * `ThreeVisualContext`, passed in here), not recreated on every sketch-edit
 * session, so entering/exiting sketch edit repeatedly doesn't spin up a new
 * worker thread each time.
 */
export class SketchWorkerSolveCoordinator {
    private listenedNodes = new Map<string, INode>();
    private resolveScheduled = false;
    private disposed = false;

    constructor(
        private readonly context: ThreeVisualContext,
        private readonly sketch: SketchGroupNode,
        private readonly session: SketchSolveSession,
    ) {
        this.context.visual.document.modelManager.addNodeObserver(this.handleDocumentNodesChanged);
        this.resubscribe();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.context.visual.document.modelManager.removeNodeObserver(this.handleDocumentNodesChanged);
        for (const node of this.listenedNodes.values()) {
            if (isPropertyChanged(node)) node.removePropertyChanged(this.handleNodePropertyChanged);
        }
        this.listenedNodes.clear();
    }

    private readonly handleDocumentNodesChanged = (records: NodeRecord[]) => {
        if (!records.some((r) => this.recordTouchesSketch(r))) return;
        this.resubscribe();
    };

    /** A moved/added node's current parent chain covers add/insert/move;
     * `oldParent`/`newParent` cover remove (whose `node.parent` is already
     * nulled out by the time this event fires) - constraint nodes are
     * always added directly under their `SketchGroupNode`, so a direct-
     * parent check is enough, no deeper ancestry walk needed. */
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
        const constraintNodes = NodeUtils.findNodes(this.sketch, (n) => n instanceof SketchConstraintNode);
        const wanted = new Map<string, INode>();
        for (const node of constraintNodes) wanted.set(node.id, node);

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

    private readonly handleNodePropertyChanged = (property: string) => {
        if (property !== "distance") return;
        this.scheduleResolve();
    };

    /** Coalesce a burst of edits into a single resolve dispatch. */
    private scheduleResolve(): void {
        if (this.resolveScheduled || this.disposed) return;
        this.resolveScheduled = true;
        queueMicrotask(async () => {
            this.resolveScheduled = false;
            if (this.disposed) return;
            const outcome = await resolveSketchViaWorker(this.sketch, this.session);
            if (this.disposed) return;
            if (outcome.status !== "converged") {
                PubSub.default.pub("showToast", "toast.constraint.unsolvable");
                return;
            }
            this.context.visual.update();
        });
    }
}
