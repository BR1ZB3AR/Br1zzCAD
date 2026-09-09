// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { CommandIcon, I18nKeys } from "@chili3d/core";
import { Localize } from "@chili3d/core";
import { createIcon, div, label } from "@chili3d/element";
import { DropdownController } from "../ribbon/dropdownController";
import style from "./contextMenu.module.css";

export interface ContextMenuItem {
    display: I18nKeys;
    icon: CommandIcon;
    onClick: () => void;
}

let current: HTMLElement | undefined;

function close(): void {
    current?.remove();
    current = undefined;
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
}

const onOutsidePointerDown = (e: PointerEvent) => {
    if (current && !current.contains(e.target as Node)) close();
};

const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
};

function positionWithinViewport(menu: HTMLElement, x: number, y: number): void {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    const rect = menu.getBoundingClientRect();
    const overflowX = rect.right - window.innerWidth;
    const overflowY = rect.bottom - window.innerHeight;
    if (overflowX > 0) menu.style.left = `${Math.max(0, x - overflowX)}px`;
    if (overflowY > 0) menu.style.top = `${Math.max(0, y - overflowY)}px`;
}

function buildMenuItem(item: ContextMenuItem): HTMLElement {
    const icon = createIcon(item.icon);
    icon.classList.add(style.dropdownIcon);
    return div(
        {
            className: style.dropdownItem,
            onclick: (e: MouseEvent) => {
                e.stopPropagation();
                close();
                item.onClick();
            },
        },
        icon,
        label({
            className: style.dropdownText,
            textContent: new Localize(item.display),
        }),
    );
}

/** Right-click context menu, positioned at a screen point rather than an
 * anchor element (unlike the ribbon's anchor-positioned `DropdownController`,
 * whose open/close machinery this otherwise mirrors). */
export function openContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
    close();
    DropdownController.closeAll();

    const menu = div({ className: style.dropdown }, ...items.map(buildMenuItem));

    document.body.append(menu);
    positionWithinViewport(menu, x, y);
    current = menu;

    // Safe to register immediately (unlike a click-triggered dropdown): the
    // `pointerdown` that led to this `contextmenu` already finished
    // propagating before `contextmenu` itself fires, so it can't be picked up
    // here as an "outside" click closing the menu it just opened.
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
}
