// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Config } from "../src/config";
import { Navigation3D, Navigation3DTypes, navigationActionMap, navigationTriggers } from "../src/navigation";
import { mockLocalStorage } from "../test-utils";

describe("Navigation3DTypes", () => {
    test("should contain Chili3d", () => {
        expect(Navigation3DTypes).toContain("Chili3d");
    });

    test("should contain Revit", () => {
        expect(Navigation3DTypes).toContain("Revit");
    });

    test("should contain Blender", () => {
        expect(Navigation3DTypes).toContain("Blender");
    });

    test("should contain Creo", () => {
        expect(Navigation3DTypes).toContain("Creo");
    });

    test("should contain Solidworks", () => {
        expect(Navigation3DTypes).toContain("Solidworks");
    });

    test("should contain TinkerCAD", () => {
        expect(Navigation3DTypes).toContain("TinkerCAD");
    });

    test("should contain Maya", () => {
        expect(Navigation3DTypes).toContain("Maya");
    });

    test("should contain Gesture", () => {
        expect(Navigation3DTypes).toContain("Gesture");
    });

    test("should contain OpenSCAD", () => {
        expect(Navigation3DTypes).toContain("OpenSCAD");
    });

    test("should contain FreeCAD", () => {
        expect(Navigation3DTypes).toContain("FreeCAD");
    });

    test("should have exactly 10 navigation types", () => {
        expect(Navigation3DTypes).toHaveLength(10);
    });
});

describe("Navigation3D.getKey", () => {
    function createMouseEvent(modifiers: {
        shiftKey?: boolean;
        ctrlKey?: boolean;
        altKey?: boolean;
    }): MouseEvent {
        return {
            shiftKey: modifiers.shiftKey ?? false,
            ctrlKey: modifiers.ctrlKey ?? false,
            altKey: modifiers.altKey ?? false,
        } as MouseEvent;
    }

    test("should return Middle for no modifiers", () => {
        const event = createMouseEvent({});
        expect(Navigation3D.getKey(event)).toBe("Middle");
    });

    test("should return Shift+Middle when shiftKey is true", () => {
        const event = createMouseEvent({ shiftKey: true });
        expect(Navigation3D.getKey(event)).toBe("Shift+Middle");
    });

    test("should return Ctrl+Middle when ctrlKey is true", () => {
        const event = createMouseEvent({ ctrlKey: true });
        expect(Navigation3D.getKey(event)).toBe("Ctrl+Middle");
    });

    test("should return Alt+Middle when altKey is true", () => {
        const event = createMouseEvent({ altKey: true });
        expect(Navigation3D.getKey(event)).toBe("Alt+Middle");
    });

    test("should return Ctrl+Shift+Middle when shiftKey and ctrlKey are true", () => {
        const event = createMouseEvent({ shiftKey: true, ctrlKey: true });
        expect(Navigation3D.getKey(event)).toBe("Ctrl+Shift+Middle");
    });

    test("should return Alt+Shift+Middle when shiftKey and altKey are true", () => {
        const event = createMouseEvent({ shiftKey: true, altKey: true });
        expect(Navigation3D.getKey(event)).toBe("Alt+Shift+Middle");
    });

    test("should return Alt+Ctrl+Middle when ctrlKey and altKey are true", () => {
        const event = createMouseEvent({ ctrlKey: true, altKey: true });
        expect(Navigation3D.getKey(event)).toBe("Alt+Ctrl+Middle");
    });

    test("should return Alt+Ctrl+Shift+Middle when all modifiers are true", () => {
        const event = createMouseEvent({ shiftKey: true, ctrlKey: true, altKey: true });
        expect(Navigation3D.getKey(event)).toBe("Alt+Ctrl+Shift+Middle");
    });
});

describe("Navigation3D.navigationKeyMap", () => {
    let localStorageMock: any;

    beforeEach(() => {
        localStorageMock = mockLocalStorage();
    });

    afterEach(() => {
        Config.instance.init("config");
    });

    describe("Chili3d", () => {
        test("should return Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Chili3d";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Middle");
        });

        test("should return Shift+Middle for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Chili3d";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Shift+Middle");
        });
    });

    describe("Revit", () => {
        test("should return Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Revit";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Middle");
        });

        test("should return Shift+Middle for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Revit";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Shift+Middle");
        });
    });

    describe("Blender", () => {
        test("should return Shift+Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Blender";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Shift+Middle");
        });

        test("should return Middle for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Blender";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Middle");
        });
    });

    describe("Creo", () => {
        test("should return Shift+Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Creo";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Shift+Middle");
        });

        test("should return Middle for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Creo";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Middle");
        });
    });

    describe("Solidworks", () => {
        test("should return Ctrl+Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Solidworks";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Ctrl+Middle");
        });

        test("should return Middle for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Solidworks";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Middle");
        });
    });

    describe("TinkerCAD", () => {
        test("should return Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "TinkerCAD";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Middle");
        });

        test("should return Right for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "TinkerCAD";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Right");
        });
    });

    describe("Maya", () => {
        test("should return Alt+Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Maya";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Alt+Middle");
        });

        test("should return Alt+Left for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Maya";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Alt+Left");
        });
    });

    describe("Gesture", () => {
        test("should return Right for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Gesture";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Right");
        });

        test("should return Alt+Left for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Gesture";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Alt+Left");
        });
    });

    describe("OpenSCAD", () => {
        test("should return Right for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "OpenSCAD";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Right");
        });

        test("should return Alt+Left for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "OpenSCAD";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Alt+Left");
        });
    });

    describe("FreeCAD", () => {
        test("should return Middle for pan", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "FreeCAD";
            expect(Navigation3D.navigationKeyMap().pan).toBe("Middle");
        });

        test("should return Middle+Left for rotate", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "FreeCAD";
            expect(Navigation3D.navigationKeyMap().rotate).toBe("Middle+Left");
        });

        test("should accept an explicit scheme override without touching Config", () => {
            Config.instance.init("testNavigation");
            Config.instance.navigation3D = "Blender";
            expect(Navigation3D.navigationKeyMap("FreeCAD").pan).toBe("Middle");
            expect(Config.instance.navigation3D).toBe("Blender");
        });
    });
});

describe("navigationActionMap", () => {
    beforeEach(() => {
        mockLocalStorage();
    });

    afterEach(() => {
        Config.instance.init("config");
    });

    test("non-FreeCAD schemes fall back to a single pan/rotate binding and no zoom binding", () => {
        Config.instance.init("testNavigation");
        Config.instance.navigation3D = "Blender";
        expect(navigationActionMap("Blender")).toEqual({
            pan: ["Shift+Middle"],
            rotate: ["Middle"],
            zoom: [],
        });
    });

    describe("FreeCAD", () => {
        test("rotates on Middle+Left, Middle+Right, and Shift+Right", () => {
            expect(navigationActionMap("FreeCAD").rotate).toEqual([
                "Middle+Left",
                "Middle+Right",
                "Shift+Right",
            ]);
        });

        test("pans on Middle and Ctrl+Right", () => {
            expect(navigationActionMap("FreeCAD").pan).toEqual(["Middle", "Ctrl+Right"]);
        });

        test("zoom-drags on Ctrl+Shift+Right", () => {
            expect(navigationActionMap("FreeCAD").zoom).toEqual(["Ctrl+Shift+Right"]);
        });
    });
});

describe("navigationTriggers", () => {
    test("Left-button triggers require Alt across every scheme that defines one", () => {
        for (const scheme of Navigation3DTypes) {
            for (const trigger of navigationTriggers(scheme)) {
                if (trigger.button === "Left") {
                    expect(trigger.requireAlt, `${scheme}: Left trigger must require Alt`).toBe(true);
                }
            }
        }
    });

    test("every scheme defines at least one trigger", () => {
        for (const scheme of Navigation3DTypes) {
            expect(navigationTriggers(scheme).length).toBeGreaterThan(0);
        }
    });

    test("FreeCAD triggers the Middle+Left/Middle+Right chords, bare Middle, and bare Right, none Alt-gated", () => {
        const triggers = navigationTriggers("FreeCAD");
        const buttons = triggers.map((t) => t.button).sort();
        expect(buttons).toEqual(["Middle", "Middle+Left", "Middle+Right", "Right"].sort());
        expect(triggers.every((t) => !t.requireAlt)).toBe(true);
    });

    test("TinkerCAD triggers bare Middle (pan) and bare Right (rotate), neither Alt-gated", () => {
        const triggers = navigationTriggers("TinkerCAD");
        const buttons = triggers.map((t) => t.button).sort();
        expect(buttons).toEqual(["Middle", "Right"]);
        expect(triggers.every((t) => !t.requireAlt)).toBe(true);
    });
});
