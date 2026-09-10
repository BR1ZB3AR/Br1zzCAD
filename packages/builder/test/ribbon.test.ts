// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { DefaultRibbon } from "../src/ribbon";

describe("DefaultRibbon", () => {
    test("should be a non-empty array of tab profiles", () => {
        expect(Array.isArray(DefaultRibbon)).toBe(true);
        expect(DefaultRibbon.length).toBeGreaterThan(0);
    });

    test("each tab should have a tabName and groups", () => {
        for (const tab of DefaultRibbon) {
            expect(tab.tabName).toBeDefined();
            expect(typeof tab.tabName).toBe("string");
            expect(Array.isArray(tab.groups)).toBe(true);
        }
    });

    test("each group should have a groupName and items array", () => {
        for (const tab of DefaultRibbon) {
            for (const group of tab.groups) {
                expect(group.groupName).toBeDefined();
                expect(typeof group.groupName).toBe("string");
                expect(Array.isArray(group.items)).toBe(true);
            }
        }
    });

    test("first tab should be the sketch tab", () => {
        expect(DefaultRibbon[0].tabName).toBe("ribbon.tab.draw");
    });

    test("second tab should be model tab", () => {
        expect(DefaultRibbon[1].tabName).toBe("ribbon.tab.model");
    });

    test("third tab should be manager tab", () => {
        expect(DefaultRibbon[2].tabName).toBe("ribbon.tab.manager");
    });

    test("sketch tab should contain a plane-picker and sketch tool commands", () => {
        const sketchTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.draw")!;
        const allItems = sketchTab.groups.flatMap((g) => flattenItems(g.items));
        expect(allItems).toContain("sketch.pickPlane");
        expect(allItems).toContain("create.line");
        expect(allItems).toContain("create.lineMidpoint");
        expect(allItems).toContain("create.rect");
        expect(allItems).toContain("create.centerRect");
        expect(allItems).toContain("create.alignedRect");
    });

    test("sketch tab's modify group should include rotate/mirror/array/trim/extend but not shell", () => {
        const sketchTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.draw")!;
        const modifyGroup = sketchTab.groups.find((g) => g.groupName === "ribbon.group.modify")!;
        const allItems = flattenItems(modifyGroup.items);
        expect(allItems).toContain("modify.move");
        expect(allItems).toContain("modify.rotate");
        expect(allItems).toContain("modify.mirror");
        expect(allItems).toContain("modify.array");
        expect(allItems).toContain("modify.trim");
        expect(allItems).toContain("modify.extend");
        expect(allItems).not.toContain("modify.shell");
    });

    test("sketch tab's modify group should include the construction-line toggle", () => {
        const sketchTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.draw")!;
        const modifyGroup = sketchTab.groups.find((g) => g.groupName === "ribbon.group.modify")!;
        const allItems = flattenItems(modifyGroup.items);
        expect(allItems).toContain("modify.toggleConstruction");
    });

    test("sketch tab's draw group starts with the construction-mode toggle", () => {
        const sketchTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.draw")!;
        const drawGroup = sketchTab.groups.find((g) => g.groupName === "ribbon.group.draw")!;
        expect(drawGroup.items[0]).toBe("sketch.toggleConstructionMode");
    });

    test("sketch tab should have a constraint group with all six Phase 1 constraints", () => {
        const sketchTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.draw")!;
        const constraintGroup = sketchTab.groups.find((g) => g.groupName === "ribbon.group.constraint")!;
        expect(constraintGroup).toBeDefined();
        const allItems = flattenItems(constraintGroup.items);
        expect(allItems).toEqual(
            expect.arrayContaining([
                "constraint.coincident",
                "constraint.horizontal",
                "constraint.vertical",
                "constraint.parallel",
                "constraint.perpendicular",
                "constraint.equal",
            ]),
        );
    });

    test("sketch tab should have a boolean group with intersect/cut/join", () => {
        const sketchTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.draw")!;
        const booleanGroup = sketchTab.groups.find((g) => g.groupName === "ribbon.group.boolean");
        expect(booleanGroup).toBeDefined();
        const allItems = flattenItems(booleanGroup!.items);
        expect(allItems).toContain("boolean.common");
        expect(allItems).toContain("boolean.cut");
        expect(allItems).toContain("boolean.join");
    });

    test("model tab should contain draw, modify, converter, boolean groups", () => {
        const modelTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.model")!;
        const groupNames = modelTab.groups.map((g) => g.groupName);
        expect(groupNames).toContain("ribbon.group.draw");
        expect(groupNames).toContain("ribbon.group.modify");
        expect(groupNames).toContain("ribbon.group.converter");
        expect(groupNames).toContain("ribbon.group.boolean");
        expect(groupNames).toContain("ribbon.group.workingPlane");
        expect(groupNames).toContain("ribbon.group.tools");
        expect(groupNames).toContain("ribbon.group.measure");
        expect(groupNames).toContain("ribbon.group.act");
        expect(groupNames).toContain("ribbon.group.importExport");
    });

    test("draw group should contain create commands", () => {
        const modelTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.model")!;
        const drawGroup = modelTab.groups.find((g) => g.groupName === "ribbon.group.draw");
        expect(drawGroup).toBeDefined();
        const allItems = flattenItems(drawGroup!.items);
        expect(allItems).toContain("create.extrude");
        expect(allItems).toContain("create.box");
    });

    test("model tab's draw group should not contain 2D sketch profile tools - those live on the sketch tab only", () => {
        const modelTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.model")!;
        const drawGroup = modelTab.groups.find((g) => g.groupName === "ribbon.group.draw")!;
        const allItems = [...flattenItems(drawGroup.items), ...(drawGroup.collapsedItems ?? [])];
        const sketchOnlyTools = [
            "create.line",
            "create.rect",
            "create.circle",
            "create.ellipse",
            "create.regularPolygon",
            "create.arc",
            "create.arc2point",
            "create.arc3point",
            "create.arcTTR",
            "create.polygon",
            "create.bezier",
        ];
        for (const tool of sketchOnlyTools) {
            expect(allItems).not.toContain(tool);
        }
    });

    test("modify group should contain modify commands", () => {
        const modelTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.model")!;
        const modifyGroup = modelTab.groups.find((g) => g.groupName === "ribbon.group.modify");
        expect(modifyGroup).toBeDefined();
        const allItems = flattenItems(modifyGroup!.items);
        expect(allItems).toContain("modify.move");
        expect(allItems).toContain("modify.rotate");
        expect(allItems).toContain("modify.fillet");
    });

    test("boolean group should contain boolean commands", () => {
        const modelTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.model")!;
        const booleanGroup = modelTab.groups.find((g) => g.groupName === "ribbon.group.boolean");
        expect(booleanGroup).toBeDefined();
        const allItems = flattenItems(booleanGroup!.items);
        expect(allItems).toContain("boolean.common");
        expect(allItems).toContain("boolean.cut");
        expect(allItems).toContain("boolean.join");
    });

    test("split-type items should have type and items properties", () => {
        const modelTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.model")!;
        const drawGroup = modelTab.groups.find((g) => g.groupName === "ribbon.group.draw");
        const splitItems = drawGroup!.items.filter(
            (item) => typeof item === "object" && "type" in item && item.type === "split",
        );
        expect(splitItems.length).toBeGreaterThan(0);
        // The filter above guarantees every entry is a split item.
        for (const split of splitItems as { type: string; items: unknown[] }[]) {
            expect(split.type).toBe("split");
            expect(Array.isArray(split.items)).toBe(true);
        }
    });

    test("groups should support collapsedItems", () => {
        const modelTab = DefaultRibbon.find((t) => t.tabName === "ribbon.tab.model")!;
        const drawGroup = modelTab.groups.find((g) => g.groupName === "ribbon.group.draw");
        expect(drawGroup!.collapsedItems).toBeDefined();
        expect(Array.isArray(drawGroup!.collapsedItems)).toBe(true);
    });

    test("all tab names should start with ribbon.tab.", () => {
        for (const tab of DefaultRibbon) {
            expect(tab.tabName.startsWith("ribbon.tab.")).toBe(true);
        }
    });

    test("all group names should start with ribbon.group.", () => {
        for (const tab of DefaultRibbon) {
            for (const group of tab.groups) {
                expect(group.groupName.startsWith("ribbon.group.")).toBe(true);
            }
        }
    });
});

/** Recursively flatten item entries that may be strings, string arrays, or {type, items} objects. */
function flattenItems(items: any[]): string[] {
    const result: string[] = [];
    for (const item of items) {
        if (typeof item === "string") {
            result.push(item);
        } else if (Array.isArray(item)) {
            result.push(...item);
        } else if (typeof item === "object" && "items" in item && Array.isArray(item.items)) {
            result.push(...flattenItems(item.items));
        }
    }
    return result;
}
