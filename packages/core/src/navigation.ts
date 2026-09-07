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
    "FreeCAD",
] as const;

export type Navigation3DType = (typeof Navigation3DTypes)[number];

export type NavButton = "Left" | "Middle" | "Right" | "Middle+Left" | "Middle+Right";

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
            // FreeCAD's own bundled "TinkerCAD" navigation style: bare Middle
            // pans, bare Right rotates, Left is left free for selection.
            return [
                { button: "Middle", requireAlt: false },
                { button: "Right", requireAlt: false },
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
        case "FreeCAD":
            // FreeCAD's default "CAD" navigation style: Middle+Left and
            // Middle+Right chords rotate, bare Middle pans, and bare Right
            // (only ever gated behind Shift/Ctrl in navigationActionMap) picks
            // the modifier-driven rotate/pan/zoom-drag modes. The chords
            // already require Middle to be held, and Right isn't used by any
            // tool, so neither needs an Alt gate.
            return [
                { button: "Middle+Left", requireAlt: false },
                { button: "Middle+Right", requireAlt: false },
                { button: "Middle", requireAlt: false },
                { button: "Right", requireAlt: false },
            ];
        default:
            return [{ button: "Middle", requireAlt: false }];
    }
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

    /** Primary pan/rotate binding per scheme, for display (e.g. the status bar
     * hint). Schemes with more than one binding for an action (see
     * navigationActionMap) list their most representative one here. */
    static navigationKeyMap(scheme: Navigation3DType = Config.instance.navigation3D): {
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
            ["FreeCAD"]: {
                pan: "Middle",
                rotate: "Middle+Left",
            },
        } satisfies Record<
            Navigation3DType,
            {
                pan: string;
                rotate: string;
            }
        >;
        return functionKey[scheme];
    }
}

export interface NavigationActionMap {
    pan: string[];
    rotate: string[];
    zoom: string[];
}

/** Full set of key bindings per action, for the view event handler. Most
 * schemes have exactly one binding for pan and one for rotate, mirroring
 * navigationKeyMap; FreeCAD's "CAD" navigation style is the exception, with
 * several alternative chords/modifiers for the same action plus a
 * drag-to-zoom binding. */
export function navigationActionMap(scheme: Navigation3DType): NavigationActionMap {
    if (scheme === "FreeCAD") {
        return {
            // Method 1 (Middle+Left) and Method 2 (Middle+Right) both rotate;
            // Shift+Right is the alternate single-button rotate mode.
            rotate: ["Middle+Left", "Middle+Right", "Shift+Right"],
            // Bare Middle pans; Ctrl+Right is the alternate single-button pan mode.
            pan: ["Middle", "Ctrl+Right"],
            // Ctrl+Shift+Right is the drag-to-zoom mode.
            zoom: ["Ctrl+Shift+Right"],
        };
    }
    const { pan, rotate } = Navigation3D.navigationKeyMap(scheme);
    return { pan: [pan], rotate: [rotate], zoom: [] };
}
