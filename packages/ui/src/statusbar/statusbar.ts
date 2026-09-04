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
import { div, label } from "@chili3d/element";
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

    constructor(className: string) {
        super();
        this.className = `${style.panel} ${className}`;

        this.setDefaultTip();
        this.render();

        this.tip.addEventListener("click", this.onTipClick);
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
            div({ className: style.left }, this.tip),
            div({ className: style.right }, new SnapConfig()),
        );
    }

    private readonly statusBarTip = (tip: I18nKeys) => {
        this.closeMenu();
        this._isDefaultTip = false;
        this.tip.classList.remove(style.tipInteractive);
        this.tip.removeAttribute("title");
        this.tip.removeAttribute("role");
        this.tip.removeAttribute("aria-haspopup");
        this.tip.removeAttribute("aria-expanded");
        I18n.set(this.tip, "textContent", tip);
    };

    private readonly setDefaultTip = () => {
        this._isDefaultTip = true;
        const scheme = Config.instance.navigation3D;
        const { pan, rotate } = Navigation3D.navigationKeyMap(scheme);
        I18n.set(
            this.tip,
            "textContent",
            "prompt.default{0}{1}{2}",
            navigation3DDisplayName(scheme),
            pan,
            rotate,
        );
        this.tip.classList.add(style.tipInteractive);
        I18n.set(this.tip, "title", "statusBar.changeNavigation");
        this.tip.setAttribute("role", "button");
        this.tip.setAttribute("aria-haspopup", "listbox");
        this.tip.setAttribute("aria-expanded", this._menu ? "true" : "false");
    };

    private readonly onTipClick = (e: Event) => {
        if (!this._isDefaultTip) return;
        e.stopPropagation();
        if (this._menu) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    };

    private openMenu() {
        this.closeMenu();

        const menu = div({
            className: style.schemeMenu,
            role: "listbox",
            "aria-label": I18n.translate("common.3DNavigation") ?? "3D Navigation",
        });

        for (const scheme of Navigation3DTypes) {
            const selected = scheme === Config.instance.navigation3D;
            menu.append(
                div(
                    {
                        className: selected ? `${style.schemeItem} ${style.schemeItemActive}` : style.schemeItem,
                        role: "option",
                        "aria-selected": selected ? "true" : "false",
                        title: navigation3DChordTitle(scheme),
                        onclick: (ev: Event) => {
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
                ),
            );
        }

        document.body.appendChild(menu);
        this.positionMenu(menu);
        this._menu = menu;
        this.tip.setAttribute("aria-expanded", "true");

        // Defer so the opening click does not immediately close the menu.
        setTimeout(() => {
            document.addEventListener("click", this.onOutsideClick);
            document.addEventListener("keydown", this.onMenuKeyDown);
        }, 0);
    }

    private positionMenu(menu: HTMLElement) {
        const rect = this.tip.getBoundingClientRect();
        menu.style.left = `${Math.max(8, rect.left)}px`;
        menu.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 4)}px`;
    }

    private selectScheme(scheme: Navigation3DType) {
        Config.instance.navigation3D = scheme;
        this.closeMenu();
    }

    private readonly onOutsideClick = (e: Event) => {
        if (this._menu && !this._menu.contains(e.target as Node) && e.target !== this.tip) {
            this.closeMenu();
        }
    };

    private readonly onMenuKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            this.closeMenu();
        }
    };

    private closeMenu() {
        if (!this._menu) return;
        this._menu.remove();
        this._menu = undefined;
        this.tip.setAttribute("aria-expanded", "false");
        document.removeEventListener("click", this.onOutsideClick);
        document.removeEventListener("keydown", this.onMenuKeyDown);
    }
}

customElements.define("chili-statusbar", Statusbar);
