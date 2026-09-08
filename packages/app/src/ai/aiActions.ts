// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, Plane, Transaction, XYZ } from "@chili3d/core";
import { BoxNode, ConeNode, CylinderNode, SphereNode } from "../bodys";

export interface AiAction {
    type: "addBox" | "addCylinder" | "addSphere" | "addCone";
    x?: number;
    y?: number;
    z?: number;
    dx?: number;
    dy?: number;
    dz?: number;
    radius?: number;
    height?: number;
}

export const AI_SYSTEM_PROMPT = `You are a CAD modeling assistant for Br1zzCAD, a browser-based 3D CAD app. All units are millimetres.

You can only create these primitive shapes, by responding with a JSON object of the exact shape:
{"actions": [ <action>, ... ]}

Each <action> is one of:
- {"type":"addBox","x":0,"y":0,"z":0,"dx":40,"dy":20,"dz":10}  (dx/dy/dz = size along X/Y/Z, x/y/z = corner position, default 0)
- {"type":"addCylinder","x":0,"y":0,"z":0,"radius":10,"height":30}
- {"type":"addSphere","x":0,"y":0,"z":0,"radius":15}
- {"type":"addCone","x":0,"y":0,"z":0,"radius":10,"height":30}  (a pointed cone - base radius only)

Rules:
- Respond with ONLY the JSON object, no other text.
- Use the user's stated dimensions in millimetres exactly; if they give none, pick a reasonable default.
- To place several shapes side by side (not overlapping), offset their x/y/z positions using each shape's own size.
- If the request needs something other than these four primitives (booleans, sketches, fillets, etc.), still return your best attempt using only these primitives - never refuse and never add prose.`;

export function parseAiActions(raw: string): AiAction[] {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0 || end < start) {
        throw new Error("Model did not return a JSON object");
    }
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const actions = parsed.actions;
    if (!Array.isArray(actions)) {
        throw new Error('Response JSON had no "actions" array');
    }
    return actions as AiAction[];
}

const VALID_TYPES = new Set(["addBox", "addCylinder", "addSphere", "addCone"]);

export interface ExecuteResult {
    created: string[];
    errors: string[];
}

/** Turns a validated action list into real document geometry, headlessly (no
 * interactive picking) - each action maps directly to the same body-node
 * classes the interactive create.box/create.cylinder/... commands use. */
export function executeAiActions(document: IDocument, actions: AiAction[]): ExecuteResult {
    const created: string[] = [];
    const errors: string[] = [];

    Transaction.execute(document, "AI Assistant", () => {
        for (const action of actions) {
            try {
                if (!VALID_TYPES.has(action.type)) {
                    throw new Error(`Unknown action type "${action.type}"`);
                }
                const origin = new XYZ({ x: action.x ?? 0, y: action.y ?? 0, z: action.z ?? 0 });
                const plane = Plane.XY.translateTo(origin);

                if (action.type === "addBox") {
                    const { dx = 10, dy = 10, dz = 10 } = action;
                    document.modelManager.addNode(new BoxNode({ document, plane, dx, dy, dz }));
                    created.push(`Box ${dx}×${dy}×${dz}mm`);
                } else if (action.type === "addCylinder") {
                    const { radius = 10, height = 10 } = action;
                    document.modelManager.addNode(
                        new CylinderNode({
                            document,
                            normal: plane.normal,
                            center: origin,
                            radius,
                            dz: height,
                        }),
                    );
                    created.push(`Cylinder r=${radius}mm h=${height}mm`);
                } else if (action.type === "addSphere") {
                    const { radius = 10 } = action;
                    document.modelManager.addNode(new SphereNode({ document, center: origin, radius }));
                    created.push(`Sphere r=${radius}mm`);
                } else if (action.type === "addCone") {
                    const { radius = 10, height = 10 } = action;
                    document.modelManager.addNode(
                        new ConeNode({ document, normal: plane.normal, center: origin, radius, dz: height }),
                    );
                    created.push(`Cone r=${radius}mm h=${height}mm`);
                }
            } catch (e) {
                errors.push(e instanceof Error ? e.message : String(e));
            }
        }
        document.visual.update();
    });

    return { created, errors };
}
