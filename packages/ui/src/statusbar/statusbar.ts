// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    Config,
    I18n,
    type I18nKeys,
    type Navigation3DType,
    Navigation3D,
    Navigation3DTypes,
    PubSub,
} from "@chili3d/core";
import { div, label, span } from "@chili3d/element";
import { navigation3DChordTitle, navigation3DDisplayName } from "../home/navigation3DLabels";
import { SnapConfig } from "./snapConfig";
import style from "./statusbar.module.css";

export class Statusbar extends HTMLElement {
    private _isDefaultTip = true;
    private _menu?: HTMLElement;

    readonly tip = label({
        textContent: "",
        className: style.tip,
    });

    readonly navButton = span({
        className: style.navButton,
        role: "button",
        tabIndex: 0,
        textContent: "",
    });

    constructor(className: string) {
        super();
        this.className = `${style.panel} ${className}`;

        this.setDefaultTip();
        this.render();

        this.navButton.addEventListener("click", this.onNavClick);
        this.navButton.addEventListener("keydown", this.onNavKeyDown);
        PubSub.default.sub("statusBarTip", this.statusBarTip);
        PubSub.default.sub("clearStatusBarTip", this.setDefaultTip);
        Config.instance.onPropertyChanged(this.handleConfigChanged);
    }

    private readonly handleConfigChanged = (prop: keyof Config) => {
        if (prop === "navigation3D" && this._isDefaultTip) {
            this.setDefaultTip();
        }
    };

    private render() {
        this.append(
            div({ className: style.left }, this.navButton, this.tip),
            div({ className: style.right }, new SnapConfig()),
        );
    }

    private readonly statusBarTip = (tip: I18nKeys) => {
        this.closeMenu();
        this._isDefaultTip = false;
        this.navButton.hidden = true;
        this.tip.classList.remove(style.tipMuted);
        I18n.set(this.tip, "textContent", tip);
    };

    private readonly setDefaultTip = () => {
        this._isDefaultTip = true;
        const scheme = Config.instance.navigation3D;
        const { pan, rotate } = Navigation3D.navigationKeyMap(scheme);
        const name = navigation3DDisplayName(scheme);

        this.navButton.hidden = false;
        this.navButton.textContent = `${name} ▾`;
        I18n.set(this.navButton, "title", "statusBar.changeNavigation");
        this.navButton.setAttribute("aria-haspopup", "listbox");
        this.navButton.setAttribute("aria-expanded", this._menu ? "true" : "false");
        this.navButton.setAttribute("aria-label", `Mouse navigation: ${name}`);

        this.tip.classList.add(style.tipMuted);
        this.tip.textContent = `${pan} to pan, ${rotate} to rotate — mouse wheel zooms`;
        this.tip.removeAttribute("title");
    };

    private readonly onNavClick = (e: Event) => {
        if (!this._isDefaultTip) return;
        e.preventDefault();
        e.stopPropagation();
        if (this._menu) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    };

    private readonly onNavKeyDown = (e: KeyboardEvent) => {
        if (!this._isDefaultTip) return;
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            if (!this._menu) this.openMenu();
        } else if (e.key === "Escape" && this._menu) {
            e.preventDefault();
            this.closeMenu();
            this.navButton.focus();
        }
    };

    private openMenu() {
        this.closeMenu();

        const menu = div({
            className: style.schemeMenu,
            role: "listbox",
            "aria-label": "3D mouse navigation",
        });

        for (const scheme of Navigation3DTypes) {
            const selected = scheme === Config.instance.navigation3D;
            const item = div(
                {
                    className: selected ? `${style.schemeItem} ${style.schemeItemActive}` : style.schemeItem,
                    role: "option",
                    "aria-selected": selected ? "true" : "false",
                    title: navigation3DChordTitle(scheme),
                    tabIndex: -1,
                    onclick: (ev: Event) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this.selectScheme(scheme);
                    },
                },
                div({
                    className: style.schemeName,
                    textContent: navigation3DDisplayName(scheme),
                }),
                div({
                    className: style.schemeChords,
                    textContent: navigation3DChordTitle(scheme),
                }),
            );
            menu.append(item);
        }

        document.body.appendChild(menu);
        this.positionMenu(menu);
        this._menu = menu;
        this.navButton.setAttribute("aria-expanded", "true");
        this.navButton.classList.add(style.navButtonOpen);

        setTimeout(() => {
            document.addEventListener("pointerdown", this.onOutsidePointer, true);
            document.addEventListener("keydown", this.onMenuKeyDown, true);
        }, 0);
    }

    private positionMenu(menu: HTMLElement) {
        const rect = this.navButton.getBoundingClientRect();
        const margin = 8;
        // Measure after attach
        const menuWidth = Math.min(320, Math.max(240, menu.offsetWidth || 240));
        const menuHeight = Math.min(420, menu.scrollHeight || 300);

        let left = rect.left;
        left = Math.min(left, window.innerWidth - menuWidth - margin);
        left = Math.max(margin, left);

        // Prefer opening upward from the status bar
        let top = rect.top - menuHeight - 6;
        if (top < margin) {
            top = Math.min(rect.bottom + 6, window.innerHeight - menuHeight - margin);
        }

        menu.style.left = `${left}px`;
        menu.style.top = `${Math.max(margin, top)}px`;
        menu.style.bottom = "auto";
        menu.style.width = `${menuWidth}px`;
    }

    private selectScheme(scheme: Navigation3DType) {
        Config.instance.navigation3D = scheme;
        this.closeMenu();
        this.setDefaultTip();
        this.navButton.focus();
    }

    private readonly onOutsidePointer = (e: Event) => {
        const target = e.target as Node | null;
        if (!this._menu || !target) return;
        if (this._menu.contains(target) || this.navButton.contains(target)) return;
        this.closeMenu();
    };

    private readonly onMenuKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            this.closeMenu();
            this.navButton.focus();
        }
    };

    private closeMenu() {
        if (!this._menu) return;
        this._menu.remove();
        this._menu = undefined;
        this.navButton.setAttribute("aria-expanded", "false");
        this.navButton.classList.remove(style.navButtonOpen);
        document.removeEventListener("pointerdown", this.onOutsidePointer, true);
        document.removeEventListener("keydown", this.onMenuKeyDown, true);
    }
}

customElements.define("chili-statusbar", Statusbar);
