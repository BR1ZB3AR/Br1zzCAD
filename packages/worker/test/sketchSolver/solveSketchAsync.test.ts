// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { CoincidentConstraint, Serializer, SketchPointHandle } from "@chili3d/core";
import { RpcHandlerRegistry } from "../../src/rpc/handlerRegistry";
import type { RpcRequest } from "../../src/rpc/protocol";
import { solveSketchInWorker } from "../../src/sketchSolver/sketchSolverWorkerApi";
import { SketchSolveSession } from "../../src/sketchSolver/solveSketchAsync";
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
