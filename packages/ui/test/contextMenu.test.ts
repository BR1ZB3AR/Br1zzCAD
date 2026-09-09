// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, test } from "@rstest/core";
import { type ContextMenuItem, openContextMenu } from "../src/project/contextMenu";
import { DropdownController } from "../src/ribbon/dropdownController";

function makeItems(overrides: Partial<ContextMenuItem>[] = [{}, {}, {}]): ContextMenuItem[] {
    return overrides.map((o, i) => ({
        display: `common.item${i}` as ContextMenuItem["display"],
        icon: "icon-command",
        onClick: () => {},
        ...o,
    }));
}

describe("openContextMenu", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("should append one menu row per item to document.body", () => {
        openContextMenu(10, 20, makeItems());
        const menu = document.body.lastElementChild as HTMLElement;
        expect(menu).not.toBeNull();
        expect(menu.children.length).toBe(3);
    });

    test("should position the menu at the given point", () => {
        openContextMenu(42, 84, makeItems());
        const menu = document.body.lastElementChild as HTMLElement;
        expect(menu.style.left).toBe("42px");
        expect(menu.style.top).toBe("84px");
    });

    test("clicking an item should call its onClick and close the menu", () => {
        let clicked = false;
        openContextMenu(0, 0, makeItems([{ onClick: () => (clicked = true) }, {}]));
        const menu = document.body.lastElementChild as HTMLElement;
        (menu.children[0] as HTMLElement).click();

        expect(clicked).toBe(true);
        expect(document.body.lastElementChild).toBeNull();
    });

    test("Escape key should close the menu", () => {
        openContextMenu(0, 0, makeItems());
        expect(document.body.lastElementChild).not.toBeNull();

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(document.body.lastElementChild).toBeNull();
    });

    test("pointerdown outside the menu should close it", () => {
        openContextMenu(0, 0, makeItems());
        expect(document.body.lastElementChild).not.toBeNull();

        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        expect(document.body.lastElementChild).toBeNull();
    });

    test("pointerdown inside the menu should not close it", () => {
        openContextMenu(0, 0, makeItems());
        const menu = document.body.lastElementChild as HTMLElement;

        menu.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        expect(document.body.lastElementChild).toBe(menu);
    });

    test("opening a second menu should close the first", () => {
        openContextMenu(0, 0, makeItems());
        const first = document.body.lastElementChild;

        openContextMenu(0, 0, makeItems());
        const second = document.body.lastElementChild;

        expect(second).not.toBe(first);
        expect(document.body.contains(first)).toBe(false);
        expect(document.body.querySelectorAll(":scope > div").length).toBe(1);
    });

    test("should close any open ribbon dropdown", () => {
        const controller = new DropdownController("ribbon-dropdown");
        const anchor = document.createElement("div");
        document.body.appendChild(anchor);
        controller.open(anchor, () => {});
        expect(controller.isOpened).toBe(true);

        openContextMenu(0, 0, makeItems());

        expect(controller.isOpened).toBe(false);
        controller.dispose();
    });
});
