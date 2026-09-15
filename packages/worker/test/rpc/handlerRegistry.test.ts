// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { RpcHandlerRegistry } from "../../src/rpc/handlerRegistry";

describe("RpcHandlerRegistry", () => {
    test("dispatches a registered action and wraps the result as ok:true", () => {
        const registry = new RpcHandlerRegistry();
        registry.register<number, number>("double", (n) => n * 2);

        const response = registry.handle({ id: "1", action: "double", payload: 21 });

        expect(response).toEqual({ id: "1", ok: true, result: 42 });
    });

    test("reports an unknown action as ok:false without throwing", () => {
        const registry = new RpcHandlerRegistry();

        const response = registry.handle({ id: "2", action: "nope", payload: undefined });

        expect(response).toEqual({ id: "2", ok: false, error: "Unknown action: nope" });
    });

    test("catches a handler's thrown error and reports it as ok:false instead of propagating", () => {
        const registry = new RpcHandlerRegistry();
        registry.register("explode", () => {
            throw new Error("boom");
        });

        const response = registry.handle({ id: "3", action: "explode", payload: undefined });

        expect(response).toEqual({ id: "3", ok: false, error: "boom" });
    });

    test("stringifies a non-Error thrown value", () => {
        const registry = new RpcHandlerRegistry();
        registry.register("explode", () => {
            throw "raw string throw";
        });

        const response = registry.handle({ id: "4", action: "explode", payload: undefined });

        expect(response).toEqual({ id: "4", ok: false, error: "raw string throw" });
    });

    test("a later registration for the same action replaces the earlier one", () => {
        const registry = new RpcHandlerRegistry();
        registry.register("action", () => "first");
        registry.register("action", () => "second");

        const response = registry.handle({ id: "5", action: "action", payload: undefined });

        expect(response).toEqual({ id: "5", ok: true, result: "second" });
    });
});
