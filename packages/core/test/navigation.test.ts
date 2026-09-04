// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Config } from "../src/config";
import {
    matchesNavigationTrigger,
    Navigation3D,
    Navigation3DTypes,
    navigationTriggers,
} from "../src/navigation";
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

    test("should have exactly 9 navigation types", () => {
        expect(Navigation3DTypes).toHaveLength(9);
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
        test("should return Middle for pan (FreeCAD TinkerCAD)", () => {
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

    test("TinkerCAD exposes ungated Right rotate and Middle pan triggers", () => {
        expect(navigationTriggers("TinkerCAD")).toEqual([
            { button: "Right", requireAlt: false },
            { button: "Middle", requireAlt: false },
        ]);
    });
});

describe("matchesNavigationTrigger", () => {
    test("Chili3d middle-button move matches", () => {
        expect(matchesNavigationTrigger("Chili3d", { button: 1, buttons: 4, altKey: false }, "move")).toBe(
            true,
        );
    });

    test("Maya plain left-button down does not match (selection must keep LMB)", () => {
        expect(matchesNavigationTrigger("Maya", { button: 0, buttons: 1, altKey: false }, "down")).toBe(
            false,
        );
    });

    test("Maya Alt+left-button down matches camera orbit", () => {
        expect(matchesNavigationTrigger("Maya", { button: 0, buttons: 1, altKey: true }, "down")).toBe(true);
    });

    test("Gesture right-button move matches pan", () => {
        expect(matchesNavigationTrigger("Gesture", { button: 2, buttons: 2, altKey: false }, "move")).toBe(
            true,
        );
    });
});
