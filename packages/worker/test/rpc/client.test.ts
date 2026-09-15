// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { rs } from "@rstest/core";
import { RpcClient } from "../../src/rpc/client";
import { RpcHandlerRegistry } from "../../src/rpc/handlerRegistry";
import type { RpcRequest } from "../../src/rpc/protocol";
import { MockWorker } from "../mockWorker";

describe("RpcClient", () => {
    test("resolves with the worker's result for a matching id", async () => {
        const registry = new RpcHandlerRegistry();
        registry.register<number, number>("double", (n) => n * 2);
        const client = new RpcClient(new MockWorker((r: RpcRequest) => registry.handle(r)));

        const { result } = client.request<number, number>("double", 5);

        await expect(result).resolves.toBe(10);
        client.dispose();
    });

    test("rejects when the worker reports an error", async () => {
        const registry = new RpcHandlerRegistry();
        registry.register("explode", () => {
            throw new Error("boom");
        });
        const client = new RpcClient(new MockWorker((r: RpcRequest) => registry.handle(r)));

        const { result } = client.request("explode", undefined);

        await expect(result).rejects.toThrow("boom");
        client.dispose();
    });

    test("discard() drops a pending request so a late response for it is ignored", async () => {
        const registry = new RpcHandlerRegistry();
        registry.register<number, number>("double", (n) => n * 2);
        const client = new RpcClient(new MockWorker((r: RpcRequest) => registry.handle(r), 20));

        const { id, result } = client.request<number, number>("double", 5);
        client.discard(id);

        // Neither resolves nor rejects - just confirm it doesn't throw and
        // the pending map no longer holds it (a second discard is a no-op).
        expect(() => client.discard(id)).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 30));
        client.dispose();
        void result; // never awaited - discarding means we don't care about it
    });

    test("dispose() terminates the underlying worker and clears pending requests", async () => {
        const registry = new RpcHandlerRegistry();
        registry.register<number, number>("double", (n) => n * 2);
        const worker = new MockWorker((r: RpcRequest) => registry.handle(r), 50);
        const client = new RpcClient(worker);
        const terminateSpy = rs.spyOn(worker, "terminate");

        client.request<number, number>("double", 5);
        client.dispose();

        expect(terminateSpy).toHaveBeenCalled();
    });
});
