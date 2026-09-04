// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Config } from "./config";

export const Navigation3DTypes = [
    "Chili3d",
    "Revit",
    "Blender",
    "Creo",
    "Solidworks",
    "TinkerCAD",
    "Maya",
    "Gesture",
    "OpenSCAD",
] as const;

export type Navigation3DType = (typeof Navigation3DTypes)[number];

export type NavButton = "Left" | "Middle" | "Right";

export interface NavTrigger {
    button: NavButton;
    /** Left-button drags double as selection/sketching everywhere else in the
     * app, so any scheme using Left must also require Alt to be held before it
     * engages the camera - otherwise every plain click would be swallowed as a
     * camera drag. Middle and Right are not used by any tool, so they need no gate. */
    requireAlt: boolean;
}

/** Each scheme lists the (button, alt-gate) pairs that can engage camera
 * navigation. Whichever configured button is actually held becomes the base
 * for Navigation3D.getKey(). */
export function navigationTriggers(scheme: Navigation3DType): NavTrigger[] {
    switch (scheme) {
        case "TinkerCAD":
            // FreeCAD TinkerCAD: Right = rotate, Middle = pan.
            return [
                { button: "Right", requireAlt: false },
                { button: "Middle", requireAlt: false },
            ];
        case "Maya":
            // Real Maya is Alt+Left=tumble, Alt+Middle=track, Alt+Right=dolly;
            // dolly is left to the scroll wheel, which already zooms in every scheme.
            return [
                { button: "Left", requireAlt: true },
                { button: "Middle", requireAlt: true },
            ];
        case "Gesture":
        case "OpenSCAD":
            // Real spec is bare Left=rotate, bare Right=pan. Right is safe as-is;
            // Left is Alt-gated here so it doesn't steal plain clicks from
            // selection/sketching tools.
            return [
                { button: "Left", requireAlt: true },
                { button: "Right", requireAlt: false },
            ];
        default:
            return [{ button: "Middle", requireAlt: false }];
    }
}

const BUTTON_FROM_CODE: Record<number, NavButton> = { 0: "Left", 1: "Middle", 2: "Right" };
const BUTTON_MASK: Record<NavButton, number> = { Left: 1, Middle: 4, Right: 2 };

/** True when the pointer event matches a camera-navigation trigger for the scheme.
 * Used so selection/sketching handlers do not also treat Alt+Left (etc.) as a pick. */
export function matchesNavigationTrigger(
    scheme: Navigation3DType,
    event: Pick<MouseEvent, "button" | "buttons" | "altKey">,
    mode: "down" | "move",
): boolean {
    for (const trigger of navigationTriggers(scheme)) {
        if (trigger.requireAlt && !event.altKey) {
            continue;
        }
        if (mode === "down") {
            if (BUTTON_FROM_CODE[event.button] === trigger.button) {
                return true;
            }
        } else if (event.buttons === BUTTON_MASK[trigger.button]) {
            return true;
        }
    }
    return false;
}

export class Navigation3D {
    static getKey(event: MouseEvent, base: NavButton = "Middle") {
        let key: string = base;
        if (event.shiftKey) {
            key = `Shift+${key}`;
        }
        if (event.ctrlKey) {
            key = `Ctrl+${key}`;
        }
        if (event.altKey) {
            key = `Alt+${key}`;
        }
        return key;
    }

    static navigationKeyMap(): {
        pan: string;
        rotate: string;
    } {
        const functionKey = {
            ["Chili3d"]: {
                pan: "Middle",
                rotate: "Shift+Middle",
            },
            ["Revit"]: {
                pan: "Middle",
                rotate: "Shift+Middle",
            },
            ["Blender"]: {
                pan: "Shift+Middle",
                rotate: "Middle",
            },
            ["Creo"]: {
                pan: "Shift+Middle",
                rotate: "Middle",
            },
            ["Solidworks"]: {
                pan: "Ctrl+Middle",
                rotate: "Middle",
            },
            ["TinkerCAD"]: {
                pan: "Middle",
                rotate: "Right",
            },
            ["Maya"]: {
                pan: "Alt+Middle",
                rotate: "Alt+Left",
            },
            ["Gesture"]: {
                pan: "Right",
                rotate: "Alt+Left",
            },
            ["OpenSCAD"]: {
                pan: "Right",
                rotate: "Alt+Left",
            },
        } satisfies Record<
            Navigation3DType,
            {
                pan: string;
                rotate: string;
            }
        >;
        return functionKey[Config.instance.navigation3D];
    }
}
