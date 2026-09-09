// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { INode } from "@chili3d/core";
// test-utils must load BEFORE the core-mock helper so the real core module is
// fully cached by the time `rs.mock("@chili3d/core")` registers.
import { createMockDocument } from "@chili3d/core/test-utils";
import { afterEach, describe, expect, rs, test } from "@rstest/core";

// CSS modules under test
rs.mock("../src/project/tree/treeItem.module.css", () => ({
    name: "ti-name",
    icon: "ti-icon",
    "parent-hidden": "ti-parent-hidden",
    editing: "ti-editing",
}));

rs.mock("../src/project/tree/treeModel.module.css", () => ({
    panel: "tm-panel",
}));

// Mock core: no-op Binding, immediate Transaction
import "./_helpers/mockCoreBinding";

// Mock element helpers
import "./_helpers/mockElement";

import { PubSub, SketchGroupNode } from "@chili3d/core";
import { TreeModel } from "../src/project/tree/treeModel";

type PropertyHandler = (property: string, model: unknown) => void;

class MockNode {
    name = "mock-node";
    visible = true;
    parentVisible: boolean | undefined = true;
    parent: MockNode | undefined;
    private handlers = new Set<PropertyHandler>();

    onPropertyChanged(handler: PropertyHandler) {
        this.handlers.add(handler);
    }
    removePropertyChanged(handler: PropertyHandler) {
        this.handlers.delete(handler);
    }
    emit(property: string) {
        this.handlers.forEach((h) => h(property, this));
    }
    handlerCount() {
        return this.handlers.size;
    }
}

function makeDoc() {
    const doc = createMockDocument();
    doc.visual.update = rs.fn(() => {});
    return doc;
}

const fakeEvent = { stopPropagation: () => {} } as MouseEvent;

describe("TreeModel (TreeItem)", () => {
    let node: MockNode;
    let doc: ReturnType<typeof makeDoc>;

    afterEach(() => {
        document.body.innerHTML = "";
    });

    function createItem(overrides: Partial<MockNode> = {}) {
        node = new MockNode();
        Object.assign(node, overrides);
        doc = makeDoc();
        return new TreeModel(doc, node as unknown as INode);
    }

    describe("rendering", () => {
        test("should render name label and visible icon", () => {
            const item = createItem();
            expect(item.name.tagName).toBe("LABEL");
            expect(item.name.className).toBe("ti-name");
            expect(item.visibleIcon.getAttribute("icon")).toBe("icon-eye");
            expect(item.visibleIcon.classList.contains("ti-icon")).toBe(true);
        });

        test("should append name and visible icon to itself with panel class", () => {
            const item = createItem();
            expect(item.classList.contains("tm-panel")).toBe(true);
            expect(item.children[0]).toBe(item.name);
            expect(item.children[1]).toBe(item.visibleIcon);
        });

        test("should be draggable", () => {
            const item = createItem();
            expect(item.draggable).toBe(true);
        });

        test("should use eye-slash icon when node is invisible", () => {
            const item = createItem({ visible: false });
            expect(item.visibleIcon.getAttribute("icon")).toBe("icon-eye-slash");
        });

        test.each([
            { parentVisible: true, hasClass: false },
            { parentVisible: false, hasClass: true },
            { parentVisible: undefined, hasClass: true },
        ])("should set parent-hidden class when parentVisible=$parentVisible", ({
            parentVisible,
            hasClass,
        }) => {
            const item = createItem({ parentVisible });
            expect(item.visibleIcon.classList.contains("ti-parent-hidden")).toBe(hasClass);
        });

        test("mainElement should return itself", () => {
            const item = createItem();
            expect(item.mainElement()).toBe(item);
        });
    });

    describe("style helpers", () => {
        test("addStyle/removeStyle should toggle classes on mainElement", () => {
            const item = createItem();
            item.addStyle("extra-style");
            expect(item.classList.contains("extra-style")).toBe(true);
            item.removeStyle("extra-style");
            expect(item.classList.contains("extra-style")).toBe(false);
        });
    });

    describe("visible icon click", () => {
        test("should toggle node visibility and update visual", () => {
            const item = createItem({ visible: true });
            (item.visibleIcon as unknown as { _onclick: (e: MouseEvent) => void })._onclick(fakeEvent);
            expect(node.visible).toBe(false);
            expect(doc.visual.update).toHaveBeenCalledTimes(1);
        });

        test("should toggle invisible node back to visible", () => {
            const item = createItem({ visible: false });
            (item.visibleIcon as unknown as { _onclick: (e: MouseEvent) => void })._onclick(fakeEvent);
            expect(node.visible).toBe(true);
        });
    });

    describe("property changed", () => {
        test("should register handler on connect and unregister on disconnect", () => {
            const item = createItem();
            expect(node.handlerCount()).toBe(0);
            document.body.appendChild(item);
            expect(node.handlerCount()).toBe(1);
            item.remove();
            expect(node.handlerCount()).toBe(0);
        });

        test("should swap visible icon when node visible property changes", () => {
            const item = createItem({ visible: true });
            document.body.appendChild(item);

            node.visible = false;
            node.emit("visible");
            expect(item.visibleIcon.getAttribute("icon")).toBe("icon-eye-slash");

            node.visible = true;
            node.emit("visible");
            expect(item.visibleIcon.getAttribute("icon")).toBe("icon-eye");
        });

        test("should update parent-hidden style when parentVisible property changes", () => {
            const item = createItem({ parentVisible: true });
            document.body.appendChild(item);
            expect(item.visibleIcon.classList.contains("ti-parent-hidden")).toBe(false);

            node.parentVisible = false;
            node.emit("parentVisible");
            expect(item.visibleIcon.classList.contains("ti-parent-hidden")).toBe(true);
        });

        test("should not react to property changes after dispose", () => {
            const item = createItem({ visible: true });
            document.body.appendChild(item);
            item.dispose();

            node.visible = false;
            node.emit("visible");
            expect(item.visibleIcon.getAttribute("icon")).toBe("icon-eye");
        });
    });

    describe("context menu", () => {
        function fireContextMenu(item: TreeModel, x = 10, y = 20) {
            item.dispatchEvent(
                new MouseEvent("contextmenu", { clientX: x, clientY: y, bubbles: true, cancelable: true }),
            );
        }

        function menuItems(): HTMLElement[] {
            // openContextMenu appends exactly one dropdown container to <body>.
            const menu = document.body.lastElementChild as HTMLElement;
            return Array.from(menu.children) as HTMLElement[];
        }

        test("should select the node and open a 3-item menu on right-click", () => {
            const item = createItem();
            document.body.appendChild(item);
            (doc.selection as any).getSelectedNodes = () => [];
            (doc.selection as any).setSelectedNodes = rs.fn(() => 0);

            fireContextMenu(item);

            expect(doc.selection.setSelectedNodes as any).toHaveBeenCalledWith([node], false);
            expect(menuItems().length).toBe(3);
        });

        test("should not re-select the node when it is already part of the selection", () => {
            const item = createItem();
            document.body.appendChild(item);
            (doc.selection as any).getSelectedNodes = () => [node];
            (doc.selection as any).setSelectedNodes = rs.fn(() => 0);

            fireContextMenu(item);

            expect(doc.selection.setSelectedNodes).not.toHaveBeenCalled();
        });

        test("first item should publish sketch.edit for a SketchGroupNode", () => {
            class TestSketchGroupNode extends (SketchGroupNode as unknown as new (...a: any[]) => any) {
                name = "Sketch 1";
                visible = true;
                parentVisible: boolean | undefined = true;
                private handlers = new Set<PropertyHandler>();
                onPropertyChanged(handler: PropertyHandler) {
                    this.handlers.add(handler);
                }
                removePropertyChanged(handler: PropertyHandler) {
                    this.handlers.delete(handler);
                }
            }
            const sketchDoc = makeDoc();
            (sketchDoc.selection as any).getSelectedNodes = () => [];
            (sketchDoc.selection as any).setSelectedNodes = () => 0;
            const sketchNode = new TestSketchGroupNode();
            const item = new TreeModel(sketchDoc, sketchNode as unknown as INode);
            document.body.appendChild(item);

            const pub = rs.fn();
            const originalPub = PubSub.default.pub;
            PubSub.default.pub = pub as any;
            try {
                fireContextMenu(item);
                const [editItem] = menuItems();
                (editItem as unknown as { _onclick: (e: MouseEvent) => void })._onclick(fakeEvent);
            } finally {
                PubSub.default.pub = originalPub;
            }

            expect(pub).toHaveBeenCalledWith("executeCommand", "sketch.edit");
        });

        test("last item should publish modify.deleteNode for any node", () => {
            const item = createItem();
            document.body.appendChild(item);
            (doc.selection as any).getSelectedNodes = () => [node];

            const pub = rs.fn();
            const originalPub = PubSub.default.pub;
            PubSub.default.pub = pub as any;
            try {
                fireContextMenu(item);
                const items = menuItems();
                (items[items.length - 1] as unknown as { _onclick: (e: MouseEvent) => void })._onclick(
                    fakeEvent,
                );
            } finally {
                PubSub.default.pub = originalPub;
            }

            expect(pub).toHaveBeenCalledWith("executeCommand", "modify.deleteNode");
        });

        test("rename item should commit a new, non-empty, trimmed name on blur", () => {
            const item = createItem();
            document.body.appendChild(item);
            (doc.selection as any).getSelectedNodes = () => [node];

            fireContextMenu(item);
            const items = menuItems();
            (items[1] as unknown as { _onclick: (e: MouseEvent) => void })._onclick(fakeEvent);

            expect(item.name.contentEditable).toBe("true");
            item.name.textContent = "  Renamed  ";
            item.name.dispatchEvent(new Event("blur"));

            expect(node.name).toBe("Renamed");
            expect(item.name.contentEditable).toBe("false");
        });

        test("rename should revert without changing the node when committed empty", () => {
            const item = createItem({ name: "Original" });
            document.body.appendChild(item);
            (doc.selection as any).getSelectedNodes = () => [node];

            fireContextMenu(item);
            const items = menuItems();
            (items[1] as unknown as { _onclick: (e: MouseEvent) => void })._onclick(fakeEvent);

            item.name.textContent = "   ";
            item.name.dispatchEvent(new Event("blur"));

            expect(node.name).toBe("Original");
            expect(item.name.textContent).toBe("Original");
        });

        test("Escape should cancel the rename and restore the original name", () => {
            const item = createItem({ name: "Original" });
            document.body.appendChild(item);
            (doc.selection as any).getSelectedNodes = () => [node];

            fireContextMenu(item);
            const items = menuItems();
            (items[1] as unknown as { _onclick: (e: MouseEvent) => void })._onclick(fakeEvent);

            item.name.textContent = "Should not stick";
            item.name.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            item.name.dispatchEvent(new Event("blur"));

            expect(node.name).toBe("Original");
            expect(item.name.textContent).toBe("Original");
        });

        test("rename should restore draggable=true after commit", () => {
            const item = createItem();
            document.body.appendChild(item);
            (doc.selection as any).getSelectedNodes = () => [node];

            fireContextMenu(item);
            const items = menuItems();
            (items[1] as unknown as { _onclick: (e: MouseEvent) => void })._onclick(fakeEvent);
            expect(item.draggable).toBe(false);

            item.name.dispatchEvent(new Event("blur"));
            expect(item.draggable).toBe(true);
        });
    });
});
