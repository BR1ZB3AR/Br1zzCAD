// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    FolderNode,
    type ISketchPointOwner,
    Plane,
    Serializer,
    SketchConstraintNode,
    SketchGroupNode,
    SketchPointHandle,
    XYZ,
} from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import { RpcHandlerRegistry } from "../../src/rpc/handlerRegistry";
import type { RpcRequest } from "../../src/rpc/protocol";
import { solveSketchInWorker } from "../../src/sketchSolver/sketchSolverWorkerApi";
import { resolveSketchViaWorker, SketchSolveSession } from "../../src/sketchSolver/solveSketchAsync";
import { MockWorker } from "../mockWorker";

function buildPayload(x: number, y: number) {
    const p1 = new SketchPointHandle({ nodeId: "a", role: "p" });
    const p2 = new SketchPointHandle({ nodeId: "b", role: "p" });
    const constraint = new CoincidentConstraint({ p1, p2 });
    return {
        initial: new Float64Array([0, 0, x, y]),
        constraints: [Serializer.serializeObject(constraint)],
        offsets: new Map([
            ["a:p", 0],
            ["b:p", 2],
        ]),
        hasParameterizedOwner: false,
    };
}

function buildRegistry() {
    const registry = new RpcHandlerRegistry();
    registry.register("solveSketch", solveSketchInWorker);
    return (r: RpcRequest) => registry.handle(r);
}

describe("SketchSolveSession", () => {
    test("resolves a single solve with the worker's result", async () => {
        const session = new SketchSolveSession(new MockWorker(buildRegistry()));

        const result = await session.solve(buildPayload(10, 10));

        expect(result).toBeDefined();
        expect(result?.rejected).toBeFalsy();
        session.dispose();
    });

    test("a rapid burst of solves: only the last one's result is ever acted on", async () => {
        // Earlier calls get a longer delay than later ones, so their
        // responses arrive AFTER the final call's - the exact "positions
        // arrive faster than the worker finishes solving" scenario a real
        // drag would produce.
        let callIndex = 0;
        const delays = [60, 45, 30, 15, 0];
        const worker = new MockWorker(buildRegistry(), () => delays[callIndex++] ?? 0);
        const session = new SketchSolveSession(worker);

        const results = await Promise.all([
            session.solve(buildPayload(1, 1)),
            session.solve(buildPayload(2, 2)),
            session.solve(buildPayload(3, 3)),
            session.solve(buildPayload(4, 4)),
            session.solve(buildPayload(5, 5)),
        ]);

        // Every call except the last resolves to undefined (discarded as stale).
        for (const stale of results.slice(0, -1)) {
            expect(stale).toBeUndefined();
        }
        expect(results.at(-1)).toBeDefined();
        expect(results.at(-1)?.rejected).toBeFalsy();
        session.dispose();
    });

    test("a stale request's error is swallowed, not thrown at the caller", async () => {
        let callIndex = 0;
        const registry = new RpcHandlerRegistry();
        registry.register("solveSketch", (payload: unknown) => {
            if (callIndex === 0) throw new Error("first call always fails");
            return solveSketchInWorker(payload as Parameters<typeof solveSketchInWorker>[0]);
        });
        const worker = new MockWorker(
            (r) => registry.handle(r),
            () => (callIndex++ === 0 ? 40 : 0),
        );
        const session = new SketchSolveSession(worker);

        const [first, second] = await Promise.all([
            session.solve(buildPayload(1, 1)),
            session.solve(buildPayload(2, 2)),
        ]);

        expect(first).toBeUndefined(); // stale failure, swallowed
        expect(second).toBeDefined();
        expect(second?.rejected).toBeFalsy();
        session.dispose();
    });

    test("the latest (non-stale) request's own error still rejects the caller", async () => {
        const registry = new RpcHandlerRegistry();
        registry.register("solveSketch", () => {
            throw new Error("real failure");
        });
        const session = new SketchSolveSession(new MockWorker((r) => registry.handle(r)));

        await expect(session.solve(buildPayload(1, 1))).rejects.toThrow("real failure");
        session.dispose();
    });

    test("dispose() cleanly tears down without leaking pending state", async () => {
        const worker = new MockWorker(buildRegistry(), 30);
        const session = new SketchSolveSession(worker);

        const pending = session.solve(buildPayload(1, 1));
        session.dispose();

        // The in-flight promise never settles after dispose (worker
        // terminated, listener removed) - awaiting it would hang, so just
        // confirm dispose itself doesn't throw and can be called again.
        expect(() => session.dispose()).not.toThrow();
        void pending;
    });
});

/** Mirrors the mock used throughout `packages/core`'s own sketch-solver
 * tests - a minimal `ISketchPointOwner` leaf, deliberately not a real
 * `LineNode` (which lives in `packages/app`). */
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

function buildSketch(doc: TestDocument) {
    const sketch = new SketchGroupNode({ document: doc, name: "Sketch", plane: Plane.XY });
    const nodeA = new MockPointOwnerNode({ document: doc, name: "a" });
    nodeA.setPoint("p", new XYZ({ x: 0, y: 0, z: 0 }));
    const nodeB = new MockPointOwnerNode({ document: doc, name: "b" });
    nodeB.setPoint("p", new XYZ({ x: 10, y: 10, z: 0 }));
    sketch.add(nodeA, nodeB);
    sketch.add(
        new SketchConstraintNode({
            document: doc,
            constraint: new CoincidentConstraint({
                p1: new SketchPointHandle({ nodeId: nodeA.id, role: "p" }),
                p2: new SketchPointHandle({ nodeId: nodeB.id, role: "p" }),
            }),
        }),
    );
    return { sketch, nodeA, nodeB };
}

/** A minimal parameterized-quartet owner (mirrors `RectNode`'s shape,
 * `packages/app/src/bodys/rect.ts`) - just enough to make
 * `buildSketchUnknowns` set `hasParameterizedOwner`, exercising
 * `resolveSketchViaWorker`'s rejection path without depending on the app
 * layer. */
class MockParameterizedOwnerNode extends FolderNode implements ISketchPointOwner {
    private u = 0;
    private v = 0;

    sketchPointRoles(): readonly string[] {
        return ["corner"];
    }
    getSketchPoint(): XYZ | undefined {
        return new XYZ({ x: this.u, y: this.v, z: 0 });
    }
    setSketchPoint(): void {}
    getSketchParameters(): number[] {
        return [this.u, this.v];
    }
    getParameterizedSketchPoint(_role: string, parameters: readonly number[]): XYZ | undefined {
        return new XYZ({ x: parameters[0], y: parameters[1], z: 0 });
    }
    setSketchParameters(parameters: readonly number[]): void {
        [this.u, this.v] = parameters;
    }
}

describe("resolveSketchViaWorker", () => {
    test("rejects (does not write anything) when the sketch has a parameterized owner", async () => {
        const doc = new TestDocument();
        const sketch = new SketchGroupNode({ document: doc, name: "Sketch", plane: Plane.XY });
        const rect = new MockParameterizedOwnerNode({ document: doc, name: "rect" });
        sketch.add(rect);
        sketch.add(
            new SketchConstraintNode({
                document: doc,
                constraint: new CoincidentConstraint({
                    p1: new SketchPointHandle({ nodeId: rect.id, role: "corner" }),
                    p2: new SketchPointHandle({ nodeId: rect.id, role: "corner" }),
                }),
            }),
        );
        const session = new SketchSolveSession(new MockWorker(buildRegistry()));

        const outcome = await resolveSketchViaWorker(sketch, session);

        expect(outcome.status).toBe("invalidGeometry");
        session.dispose();
    });

    test("writes a converged result back into the live document nodes", async () => {
        const doc = new TestDocument();
        const { sketch, nodeA, nodeB } = buildSketch(doc);
        const session = new SketchSolveSession(new MockWorker(buildRegistry()));

        const outcome = await resolveSketchViaWorker(sketch, session);

        expect(outcome.status).toBe("converged");
        expect(nodeA.getSketchPoint("p")!.distanceTo(nodeB.getSketchPoint("p")!)).toBeLessThan(1e-7);
        session.dispose();
    });

    test("a sketch with no constraints converges trivially without touching the worker", async () => {
        const doc = new TestDocument();
        const sketch = new SketchGroupNode({ document: doc, name: "Sketch", plane: Plane.XY });
        const session = new SketchSolveSession(new MockWorker(buildRegistry()));

        const outcome = await resolveSketchViaWorker(sketch, session);

        expect(outcome.status).toBe("converged");
        expect(outcome.finalResidualNorm).toBe(0);
        session.dispose();
    });

    // Note: whether the write-back records exactly one undo entry can't be
    // meaningfully asserted against `MockPointOwnerNode` - like the mocks
    // `packages/core/test/sketchSolverRunner.test.ts` already uses, its
    // `setSketchPoint` is a bare map write, not a real `@property`-backed
    // setter, so it never reaches `Transaction.add` regardless of whether
    // `resolveSketchViaWorker` wraps the write-back in a transaction or
    // not. The wrapping itself is a direct, one-line call in the source
    // (`Transaction.execute(sketch.document, "resolve sketch (worker)", ...)`)
    // - covered by real usage once a real `LineNode` is involved (see the
    // live Playwright verification in this feature's shipping checklist).
});
