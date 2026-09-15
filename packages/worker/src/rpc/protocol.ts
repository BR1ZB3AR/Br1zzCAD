// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/** Wire shape sent main-thread -> worker. `action` is a string discriminant
 * the worker-side registry dispatches on; `payload` must be structured-clone
 * safe (plain data, typed arrays, Map/Set - never closures or live document
 * objects). */
export interface RpcRequest<TAction extends string = string, TPayload = unknown> {
    id: string;
    action: TAction;
    payload: TPayload;
}

/** Wire shape sent worker -> main-thread, one per request `id`. */
export type RpcResponse<TResult = unknown> =
    | { id: string; ok: true; result: TResult }
    | { id: string; ok: false; error: string };

/** A worker-side handler for one action - a pure function of payload to
 * result, with no reference to `self`/`postMessage`, so it's directly
 * unit-testable independent of any real worker or message-passing
 * machinery. */
export type RpcHandler<TPayload = unknown, TResult = unknown> = (payload: TPayload) => TResult;
