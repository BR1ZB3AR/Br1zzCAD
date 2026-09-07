import type { Navigation3DType } from "../navigation";
import type { CommandKeys } from "./commandKeys";

type ShortcutMap = Partial<Record<CommandKeys, string | string[]>>;

export const Chili3dShortcuts: ShortcutMap = {
    // System
    "doc.save": "ctrl+s",
    "doc.open": "ctrl+o",
    "edit.undo": "ctrl+z",
    "edit.redo": ["ctrl+y", "ctrl+shift+z"],
    "modify.deleteNode": ["Delete", "Backspace"],
    "special.last": [" ", "Enter"],

    // Sketching
    "create.line": "l",
    "create.rect": "r",
    "create.circle": "c",
    "measure.length": "d",

    // Primitives
    "create.box": "b",
    "create.sphere": "s",
    "create.cylinder": "y",
    "create.cone": "n",
    "create.pipe": "shift+p",

    // Modify
    "modify.trim": "t",
    "create.offset": "o",
    "modify.rotate": "shift+r",
    "create.extrude": "p",
    "modify.move": "m",
    "modify.array": "shift+a",
    "boolean.common": "shift+i",
    "modify.explode": "x",
    "modify.chamfer": "shift+c",
    "modify.fillet": "shift+f",
};

export const DefaultShortcuts: ShortcutMap = Chili3dShortcuts;

export const RevitShortcuts: ShortcutMap = {
    ...Chili3dShortcuts,
    "modify.move": "m+v", // MV
    "modify.rotate": "r+o", // RO
    "modify.trim": "t+r", // TR
    "create.line": "l+i", // LI
    // Add more as needed
};

export const BlenderShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
    "modify.move": "g",
    "modify.rotate": "r",
    "create.extrude": "e",
    // "delete": "x" // if key exists
};

export const SolidworksShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
    "create.line": "l",
    // Often heavily mouse/gesture based or S-key menu
};

export const CreoShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
};

export const TinkerCADShortcuts: ShortcutMap = {
    // TinkerCAD is a mouse/gesture-driven beginner tool with no real hotkey
    // scheme of its own - keep the default keyboard shortcuts, only its
    // right-mouse-button navigation (see navigation.ts) is distinctive.
    ...DefaultShortcuts,
};

export const MayaShortcuts: ShortcutMap = {
    // Maya is likewise mouse/Alt-drag driven for navigation; only its
    // Alt-gated Left/Middle camera controls (see navigation.ts) are distinctive.
    ...DefaultShortcuts,
};

export const GestureShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
};

export const OpenSCADShortcuts: ShortcutMap = {
    ...DefaultShortcuts,
};

export const FreeCADShortcuts: ShortcutMap = {
    // FreeCAD's own keyboard shortcuts don't map onto Br1zzCAD's command set;
    // only its distinctive "CAD" navigation-style mouse bindings (see
    // navigation.ts) are adopted here.
    ...DefaultShortcuts,
};

export const ShortcutProfiles: Record<Navigation3DType, ShortcutMap> = {
    Chili3d: Chili3dShortcuts,
    Revit: RevitShortcuts,
    Blender: BlenderShortcuts,
    Creo: CreoShortcuts,
    Solidworks: SolidworksShortcuts,
    TinkerCAD: TinkerCADShortcuts,
    Maya: MayaShortcuts,
    Gesture: GestureShortcuts,
    OpenSCAD: OpenSCADShortcuts,
    FreeCAD: FreeCADShortcuts,
};
