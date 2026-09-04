// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, NodeUtils, Plane, Transaction, XYZ } from "@chili3d/core";
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

export const AI_SYSTEM_PROMPT = `You are a CAD modeling assistant for Br1zzCAD, a browser-based 3D CAD app.

Coordinate system (right-handed):
- Units are millimetres. If the user gives inches, convert with 1 in = 25.4 mm.
- XY is the ground plane; +Z is up.
- For boxes, x/y/z is the minimum corner; dx/dy/dz are sizes along X/Y/Z.
- For cylinder/sphere/cone, x/y/z is the center (sphere) or base center on XY (cylinder/cone); height extends along +Z.

You can only create these primitive shapes by responding with a JSON object of this exact shape:
{"actions": [ <action>, ... ]}

Each <action> is one of:
- {"type":"addBox","x":0,"y":0,"z":0,"dx":40,"dy":20,"dz":10}
- {"type":"addCylinder","x":0,"y":0,"z":0,"radius":10,"height":30}
- {"type":"addSphere","x":0,"y":0,"z":0,"radius":15}
- {"type":"addCone","x":0,"y":0,"z":0,"radius":10,"height":30}  (pointed cone, base radius only)

Examples:
User: add a 40x20x10 box
{"actions":[{"type":"addBox","x":0,"y":0,"z":0,"dx":40,"dy":20,"dz":10}]}

User: cylinder r=15 h=40 next to a sphere r=20
{"actions":[{"type":"addCylinder","x":0,"y":0,"z":0,"radius":15,"height":40},{"type":"addSphere","x":50,"y":0,"z":20,"radius":20}]}

User: stack three 20mm cubes along Z
{"actions":[{"type":"addBox","x":0,"y":0,"z":0,"dx":20,"dy":20,"dz":20},{"type":"addBox","x":0,"y":0,"z":20,"dx":20,"dy":20,"dz":20},{"type":"addBox","x":0,"y":0,"z":40,"dx":20,"dy":20,"dz":20}]}

Rules:
- Respond with ONLY the JSON object, no markdown fences and no other text.
- Use the user's stated dimensions in millimetres exactly; if they give none, pick a reasonable default (often 10–40 mm).
- To place several shapes side by side (not overlapping), offset x/y/z using each shape's own size (and radius*2 for spheres).
- Prefer placing new geometry near the origin or beside existing shapes described in the scene context — do not stack everything at (0,0,0) unless asked.
- If the request needs something other than these four primitives (booleans, sketches, fillets, etc.), still return your best attempt using only these primitives — never refuse and never add prose.
- All numeric fields must be finite numbers. Sizes (dx/dy/dz/radius/height) must be positive.`;

function readNumber(obj: Record<string, unknown>, key: string): number | undefined {
    const value = obj[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Compact summary of non-folder nodes so the model can avoid overlaps / place relative to existing work. */
export function buildSceneContext(document: IDocument): string {
    const nodes = document.modelManager.findNodes((node) => !NodeUtils.isLinkedListNode(node));
    if (nodes.length === 0) {
        return "Scene context: empty (no solids yet).";
    }

    const lines: string[] = [];
    for (const node of nodes.slice(0, 40)) {
        const anyNode = node as unknown as Record<string, unknown>;
        const parts: string[] = [node.name || "unnamed"];

        const plane = anyNode["plane"] as { origin?: { x: number; y: number; z: number } } | undefined;
        const center = anyNode["center"] as { x: number; y: number; z: number } | undefined;
        const origin = plane?.origin ?? center;
        if (origin && typeof origin.x === "number") {
            parts.push(`at (${fmt(origin.x)}, ${fmt(origin.y)}, ${fmt(origin.z)})`);
        }

        const radius = readNumber(anyNode, "radius");
        const dx = readNumber(anyNode, "dx");
        const dy = readNumber(anyNode, "dy");
        const dz = readNumber(anyNode, "dz");
        if (dx !== undefined) parts.push(`dx=${fmt(dx)}`);
        if (dy !== undefined) parts.push(`dy=${fmt(dy)}`);
        if (dz !== undefined) parts.push(`${radius !== undefined ? "height" : "dz"}=${fmt(dz)}`);
        if (radius !== undefined) parts.push(`radius=${fmt(radius)}`);

        lines.push(`- ${parts.join(", ")}`);
    }

    const extra = nodes.length > 40 ? `\n- …and ${nodes.length - 40} more` : "";
    return `Scene context (${nodes.length} solid${nodes.length === 1 ? "" : "s"}):\n${lines.join("\n")}${extra}`;
}

function fmt(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Builds the user message sent to the model, including live document context. */
export function buildUserPrompt(userText: string, document: IDocument): string {
    return `${buildSceneContext(document)}\n\nUser request: ${userText.trim()}`;
}

function stripCodeFences(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
}

function asFiniteNumber(value: unknown, fallback?: number): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

const VALID_TYPES = new Set(["addBox", "addCylinder", "addSphere", "addCone"]);

function normalizeAction(raw: unknown, index: number): AiAction {
    if (!raw || typeof raw !== "object") {
        throw new Error(`Action ${index} is not an object`);
    }
    const action = raw as Record<string, unknown>;
    const type = action["type"];
    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
        throw new Error(`Action ${index} has unknown type "${String(type)}"`);
    }

    const normalized: AiAction = { type: type as AiAction["type"] };
    for (const key of ["x", "y", "z", "dx", "dy", "dz", "radius", "height"] as const) {
        const num = asFiniteNumber(action[key]);
        if (num !== undefined) {
            normalized[key] = num;
        }
    }

    const sizeKeys =
        normalized.type === "addBox"
            ? (["dx", "dy", "dz"] as const)
            : normalized.type === "addSphere"
              ? (["radius"] as const)
              : (["radius", "height"] as const);

    for (const key of sizeKeys) {
        const value = normalized[key];
        if (value !== undefined && value <= 0) {
            throw new Error(`Action ${index} has non-positive ${key}=${value}`);
        }
    }

    return normalized;
}

export function parseAiActions(raw: string): AiAction[] {
    const text = stripCodeFences(raw);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0 || end < start) {
        throw new Error("Model did not return a JSON object");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
        throw new Error("Model returned invalid JSON");
    }

    if (!parsed || typeof parsed !== "object") {
        throw new Error("Model returned a non-object JSON value");
    }

    const actions = (parsed as { actions?: unknown }).actions;
    if (!Array.isArray(actions)) {
        throw new Error('Response JSON had no "actions" array');
    }

    return actions.map((action, index) => normalizeAction(action, index));
}

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
                        new ConeNode({
                            document,
                            normal: plane.normal,
                            center: origin,
                            radius,
                            dz: height,
                        }),
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
