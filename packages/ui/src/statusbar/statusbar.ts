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
    private _optionEls: HTMLElement[] = [];
    private _activeIndex = 0;

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

    readonly navGroup = span({
        className: style.navGroup,
    });

    constructor(className: string) {
        super();
        this.className = `${style.panel} ${className}`;

        this.navGroup.append(this.navButton, this.tip);
        this.setDefaultTip();
        this.render();

        this.navGroup.addEventListener("click", this.onNavClick);
        this.navButton.addEventListener("keydown", this.onNavKeyDown);
        this.tip.addEventListener("keydown", this.onNavKeyDown);
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
            div({ className: style.left }, this.navGroup),
            div({ className: style.right }, new SnapConfig()),
        );
    }

    private readonly statusBarTip = (tip: I18nKeys) => {
        this.closeMenu();
        this._isDefaultTip = false;
        this.navButton.hidden = true;
        this.tip.classList.remove(style.tipMuted);
        this.tip.classList.remove(style.tipClickable);
        this.tip.removeAttribute("tabIndex");
        this.tip.removeAttribute("role");
        this.navGroup.classList.remove(style.navGroupInteractive);
        I18n.set(this.tip, "textContent", tip);
    };

    private readonly setDefaultTip = () => {
        this._isDefaultTip = true;
        const scheme = Config.instance.navigation3D;
        const { pan, rotate } = Navigation3D.navigationKeyMap(scheme);
        const name = navigation3DDisplayName(scheme);

        this.navGroup.classList.add(style.navGroupInteractive);
        this.navButton.hidden = false;
        this.navButton.textContent = `Mouse · ${name}`;
        this.navButton.append(span({ className: style.navChevron, textContent: "▾" }));
        I18n.set(this.navButton, "title", "statusBar.changeNavigation");
        this.navButton.setAttribute("aria-haspopup", "listbox");
        this.navButton.setAttribute("aria-expanded", this._menu ? "true" : "false");
        this.navButton.setAttribute("aria-label", `Mouse navigation: ${name}. Click to change.`);

        this.tip.classList.add(style.tipMuted, style.tipClickable);
        this.tip.tabIndex = -1;
        this.tip.setAttribute("role", "presentation");
        this.tip.textContent = `${pan} pan · ${rotate} rotate · wheel zoom`;
        I18n.set(this.tip, "title", "statusBar.changeNavigation");
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
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            if (!this._menu) {
                this.openMenu(e.key === "ArrowUp" ? "last" : "active");
            }
        } else if (e.key === "Escape" && this._menu) {
            e.preventDefault();
            e.stopPropagation();
            this.closeMenu();
            this.navButton.focus();
        }
    };

    private openMenu(focus: "active" | "last" = "active") {
        this.closeMenu();

        const current = Config.instance.navigation3D;
        this._optionEls = [];
        this._activeIndex = Math.max(0, Navigation3DTypes.indexOf(current));

        const menu = div({
            className: style.schemeMenu,
            role: "listbox",
            "aria-label": "3D mouse navigation",
            tabIndex: -1,
        });

        // Swallow pointer events so the 3D viewport does not rotate/pan underneath.
        menu.addEventListener("pointerdown", (ev) => ev.stopPropagation());
        menu.addEventListener("pointerup", (ev) => ev.stopPropagation());
        menu.addEventListener("mousedown", (ev) => ev.stopPropagation());
        menu.addEventListener("wheel", (ev) => ev.stopPropagation(), { passive: true });

        Navigation3DTypes.forEach((scheme, index) => {
            const selected = scheme === current;
            const item = div(
                {
                    className: selected ? `${style.schemeItem} ${style.schemeItemActive}` : style.schemeItem,
                    role: "option",
                    "aria-selected": selected ? "true" : "false",
                    id: `nav-scheme-option-${index}`,
                    title: navigation3DChordTitle(scheme),
                    tabIndex: -1,
                    onclick: (ev: Event) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        this.selectScheme(scheme);
                    },
                    onmouseenter: () => this.setActiveIndex(index, false),
                },
                div({
                    className: style.schemeRow,
                },
                    span({
                        className: style.schemeCheck,
                        textContent: selected ? "✓" : "",
                        "aria-hidden": "true",
                    }),
                    div(
                        { className: style.schemeText },
                        div({
                            className: style.schemeName,
                            textContent: navigation3DDisplayName(scheme),
                        }),
                        div({
                            className: style.schemeChords,
                            textContent: navigation3DChordTitle(scheme),
                        }),
                    ),
                ),
            );
            this._optionEls.push(item);
            menu.append(item);
        });

        document.body.appendChild(menu);
        this._menu = menu;
        this.navButton.setAttribute("aria-expanded", "true");
        this.navButton.setAttribute("aria-controls", "nav-scheme-menu");
        menu.id = "nav-scheme-menu";
        this.navButton.classList.add(style.navButtonOpen);
        this.navGroup.classList.add(style.navGroupOpen);

        requestAnimationFrame(() => {
            if (this._menu !== menu) return;
            this.positionMenu(menu);
            const focusIndex = focus === "last" ? this._optionEls.length - 1 : this._activeIndex;
            this.setActiveIndex(focusIndex, true);
        });

        // Defer outside listeners so the opening click does not close immediately.
        setTimeout(() => {
            if (this._menu !== menu) return;
            document.addEventListener("pointerdown", this.onOutsidePointer, true);
            document.addEventListener("keydown", this.onMenuKeyDown, true);
        }, 0);
    }

    private positionMenu(menu: HTMLElement) {
        const anchor = this.navGroup.getBoundingClientRect();
        const margin = 8;
        const gap = 6;
        const menuRect = menu.getBoundingClientRect();
        const menuWidth = Math.min(320, Math.max(260, menuRect.width || 260));
        const menuHeight = Math.min(
            Math.min(420, window.innerHeight - margin * 2),
            menuRect.height || menu.scrollHeight || 300,
        );

        let left = anchor.left;
        left = Math.min(left, window.innerWidth - menuWidth - margin);
        left = Math.max(margin, left);

        // Prefer opening upward above the status bar; flip down only if needed.
        let top = anchor.top - menuHeight - gap;
        if (top < margin) {
            top = Math.min(anchor.bottom + gap, window.innerHeight - menuHeight - margin);
            top = Math.max(margin, top);
        }

        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
        menu.style.bottom = "auto";
        menu.style.width = `${Math.round(menuWidth)}px`;
        menu.style.maxHeight = `${Math.round(Math.min(420, window.innerHeight - margin * 2))}px`;
    }

    private setActiveIndex(index: number, focusItem: boolean) {
        if (!this._optionEls.length) return;
        const next = Math.max(0, Math.min(this._optionEls.length - 1, index));
        this._optionEls.forEach((el, i) => {
            el.classList.toggle(style.schemeItemFocus, i === next);
        });
        this._activeIndex = next;
        const active = this._optionEls[next];
        this.navButton.setAttribute("aria-activedescendant", active.id);
        if (focusItem) {
            active.focus();
            active.scrollIntoView({ block: "nearest" });
        }
    }

    private selectScheme(scheme: Navigation3DType) {
        Config.instance.navigation3D = scheme;
        // Refresh tip immediately (Config listener also fires; keep explicit for snappy UX).
        this.closeMenu();
        this.setDefaultTip();
        this.navButton.focus();
    }

    private readonly onOutsidePointer = (e: Event) => {
        const target = e.target as Node | null;
        if (!this._menu || !target) return;
        if (this._menu.contains(target) || this.navGroup.contains(target)) return;
        this.closeMenu();
    };

    private readonly onMenuKeyDown = (e: KeyboardEvent) => {
        if (!this._menu) return;

        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.closeMenu();
            this.navButton.focus();
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            this.setActiveIndex(this._activeIndex + 1, true);
            return;
        }

        if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            this.setActiveIndex(this._activeIndex - 1, true);
            return;
        }

        if (e.key === "Home") {
            e.preventDefault();
            e.stopPropagation();
            this.setActiveIndex(0, true);
            return;
        }

        if (e.key === "End") {
            e.preventDefault();
            e.stopPropagation();
            this.setActiveIndex(this._optionEls.length - 1, true);
            return;
        }

        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            const scheme = Navigation3DTypes[this._activeIndex];
            if (scheme) this.selectScheme(scheme);
        }
    };

    private closeMenu() {
        if (!this._menu) return;
        this._menu.remove();
        this._menu = undefined;
        this._optionEls = [];
        this.navButton.setAttribute("aria-expanded", "false");
        this.navButton.removeAttribute("aria-activedescendant");
        this.navButton.classList.remove(style.navButtonOpen);
        this.navGroup.classList.remove(style.navGroupOpen);
        document.removeEventListener("pointerdown", this.onOutsidePointer, true);
        document.removeEventListener("keydown", this.onMenuKeyDown, true);
    }
}

customElements.define("chili-statusbar", Statusbar);
