// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    DistanceConstraint,
    FolderNode,
    type ISketchPointOwner,
    Plane,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
    XYZ,
} from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import {
    RpcHandlerRegistry,
    type RpcRequest,
    type RpcResponse,
    SketchSolveSession,
    solveSketchInWorker,
    type WorkerLike,
} from "@chili3d/worker";
import { rs } from "@rstest/core";
import { SketchWorkerSolveCoordinator } from "../src/sketchWorkerSolveCoordinator";

class MockPointOwnerNode extends FolderNode implements ISketchPointOwner {
    private readonly points = new Map<string, XYZ>();

    setPoint(role: string, point: XYZ) {
        this.points.set(role, point);
    }

    sketchPointRoles(): readonly string[] {
        return Array.from(this.points.keys());
    }

    getSketchPoint(role: string): XYZ | undefined {
        return this.points.get(role);
    }

    setSketchPoint(role: string, point: XYZ): void {
        this.points.set(role, point);
    }
}

/** A minimal in-process `WorkerLike`, wired to the real `solveSketchInWorker`
 * handler so this test exercises the actual solve math end-to-end, not a
 * stub - `packages/worker`'s own `test/mockWorker.ts` isn't reused directly
 * since test-only files aren't shared across package boundaries. */
class InlineMockWorker implements WorkerLike {
    private readonly registry = new RpcHandlerRegistry();
    private listeners: ((event: MessageEvent<RpcResponse>) => void)[] = [];

    constructor() {
        this.registry.register("solveSketch", solveSketchInWorker);
    }

    postMessage(message: unknown): void {
        const request = message as RpcRequest;
        queueMicrotask(() => {
            const response = this.registry.handle(request);
            for (const listener of this.listeners) listener({ data: response } as MessageEvent<RpcResponse>);
        });
    }

    addEventListener(_type: "message", listener: (event: MessageEvent<RpcResponse>) => void): void {
        this.listeners.push(listener);
    }

    removeEventListener(_type: "message", listener: (event: MessageEvent<RpcResponse>) => void): void {
        this.listeners = this.listeners.filter((l) => l !== listener);
    }

    terminate(): void {
        this.listeners = [];
    }
}

function buildContext(doc: TestDocument) {
    return {
        getVisual: rs.fn(),
        visual: { document: doc, update: rs.fn() },
    };
}

async function flushMicrotasks() {
    for (let i = 0; i < 4; i++) await Promise.resolve();
}

function buildDistanceSketch(doc: TestDocument) {
    const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
    const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
    nodeA.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
    const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
    nodeB.setPoint("p", new XYZ({ x: 10, y: 0, z: 0 }));
    sketch.add(nodeA, nodeB);
    const constraint = new DistanceConstraint({
        p1: new SketchPointHandle({ nodeId: nodeA.id, role: "p" }),
        p2: new SketchPointHandle({ nodeId: nodeB.id, role: "p" }),
        distance: 10,
    });
    const constraintNode = new SketchConstraintNode({ document: doc, constraint });
    sketch.add(constraintNode);
    return { sketch, nodeA, nodeB, constraintNode };
}

describe("SketchWorkerSolveCoordinator", () => {
    test("a distance property change dispatches a worker resolve and writes the result back", async () => {
        const doc = new TestDocument();
        const { sketch, nodeA, nodeB, constraintNode } = buildDistanceSketch(doc);
        const context = buildContext(doc);
        const session = new SketchSolveSession(new InlineMockWorker());
        const coordinator = new SketchWorkerSolveCoordinator(context as any, sketch, session);
        await flushMicrotasks();

        constraintNode.distance = 20;
        await flushMicrotasks();

        expect(nodeA.getSketchPoint("p")!.distanceTo(nodeB.getSketchPoint("p")!)).toBeCloseTo(20, 5);
        expect(context.visual.update).toHaveBeenCalled();
        coordinator.dispose();
        session.dispose();
    });

    test("a non-distance property change does not trigger a resolve", async () => {
        const doc = new TestDocument();
        const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
        nodeA.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
        const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
        nodeB.setPoint("p", new XYZ({ x: 10, y: 0, z: 0 }));
        sketch.add(nodeA, nodeB);
        const constraintNode = new SketchConstraintNode({
            document: doc,
            constraint: new CoincidentConstraint({
                p1: new SketchPointHandle({ nodeId: nodeA.id, role: "p" }),
                p2: new SketchPointHandle({ nodeId: nodeB.id, role: "p" }),
            }),
        });
        sketch.add(constraintNode);
        const context = buildContext(doc);
        const session = new SketchSolveSession(new InlineMockWorker());
        const coordinator = new SketchWorkerSolveCoordinator(context as any, sketch, session);
        await flushMicrotasks();
        (context.visual.update as any).mockClear();

        // Coincident has no `distance` property to change - nothing here
        // should ever reach the worker.
        (constraintNode as any).emitPropertyChanged("someOtherProp", undefined);
        await flushMicrotasks();

        expect(context.visual.update).not.toHaveBeenCalled();
        coordinator.dispose();
        session.dispose();
    });

    test("dispose stops reacting to further distance changes", async () => {
        const doc = new TestDocument();
        const { sketch, nodeA, nodeB, constraintNode } = buildDistanceSketch(doc);
        const context = buildContext(doc);
        const session = new SketchSolveSession(new InlineMockWorker());
        const coordinator = new SketchWorkerSolveCoordinator(context as any, sketch, session);
        await flushMicrotasks();

        coordinator.dispose();
        (context.visual.update as any).mockClear();
        constraintNode.distance = 30;
        await flushMicrotasks();

        expect(context.visual.update).not.toHaveBeenCalled();
        expect(nodeA.getSketchPoint("p")!.distanceTo(nodeB.getSketchPoint("p")!)).toBeCloseTo(10, 5);
        session.dispose();
    });
});
