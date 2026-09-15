// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { RpcHandlerRegistry } from "../rpc/handlerRegistry";
import type { RpcRequest } from "../rpc/protocol";
import { solveSketchInWorker } from "./sketchSolverWorkerApi";

/** Minimal shim: avoids pulling in the "webworker" lib, which conflicts
 * with this repo's single root tsconfig (implicit "dom" lib, via
 * `tsconfig.json`'s default lib set) - see `packages/global.d.ts` for the
 * existing precedent of narrow ambient shims over full lib inclusion. Only
 * the members this file actually uses are declared; `MessageEvent` already
 * comes from the implicit "dom" lib (identical type in both libs), so only
 * `self` needs shadowing. Keep this shim confined to `*.worker.ts` entry
 * files - every other file in this package stays plain, environment-
 * agnostic TS with no `self` reference. */
interface WorkerGlobalScope {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    onmessage: ((event: MessageEvent<RpcRequest>) => void) | null;
}
declare const self: WorkerGlobalScope;

const registry = new RpcHandlerRegistry();
registry.register("solveSketch", solveSketchInWorker);

self.onmessage = (event) => {
    self.postMessage(registry.handle(event.data));
};
