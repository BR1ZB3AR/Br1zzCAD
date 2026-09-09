// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Binding, type IDocument, type INode, PubSub, SketchGroupNode, Transaction } from "@chili3d/core";
import { label, setSVGIcon, svg } from "@chili3d/element";
import { type ContextMenuItem, openContextMenu } from "../contextMenu";
import style from "./treeItem.module.css";

export abstract class TreeItem extends HTMLElement {
    readonly name: HTMLLabelElement;
    readonly visibleIcon: SVGSVGElement;

    private _node: INode;
    get node() {
        return this._node;
    }

    constructor(
        private document: IDocument,
        node: INode,
    ) {
        super();
        this._node = node;
        this.draggable = true;
        this.name = label({
            className: style.name,
            textContent: new Binding(node, "name"),
        });
        this.visibleIcon = svg({
            className: style.icon,
            icon: this.getVisibleIcon(),
            onclick: this.onVisibleIconClick,
        });
        this.setVisibleStyle(node.parentVisible);
        this.addEventListener("contextmenu", this.onContextMenu);
    }

    connectedCallback(): void {
        this.node.onPropertyChanged(this.onPropertyChanged);
    }

    disconnectedCallback(): void {
        this.node.removePropertyChanged(this.onPropertyChanged);
    }

    private readonly onPropertyChanged = (property: keyof INode, model: INode) => {
        if (property === "visible") {
            setSVGIcon(this.visibleIcon, this.getVisibleIcon());
        } else if (property === "parentVisible") {
            this.setVisibleStyle(model[property]);
        }
    };

    private setVisibleStyle(parentVisible?: boolean) {
        if (parentVisible === true) {
            this.visibleIcon.classList.remove(style["parent-hidden"]);
        } else {
            this.visibleIcon.classList.add(style["parent-hidden"]);
        }
    }

    addStyle(style: string) {
        this.mainElement().classList.add(style);
    }

    removeStyle(style: string) {
        this.mainElement().classList.remove(style);
    }

    abstract mainElement(): HTMLElement;

    dispose() {
        this.remove();
        this.node.removePropertyChanged(this.onPropertyChanged);
        this.visibleIcon.removeEventListener("click", this.onVisibleIconClick);
        this.removeEventListener("contextmenu", this.onContextMenu);
        this.document = null as any;
        this._node = null as any;
    }

    private getVisibleIcon() {
        return this.node.visible ? "icon-eye" : "icon-eye-slash";
    }

    private readonly onVisibleIconClick = (e: MouseEvent) => {
        e.stopPropagation();
        Transaction.execute(this.document, "change visible", () => {
            this.node.visible = !this.node.visible;
        });
        this.document.visual.update();
    };

    private readonly onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!this.document.selection.getSelectedNodes().includes(this.node)) {
            this.document.selection.setSelectedNodes([this.node], false);
        }

        const items: ContextMenuItem[] = [];
        if (this.node instanceof SketchGroupNode) {
            items.push({
                display: "command.sketch.edit",
                icon: "icon-edit",
                onClick: () => PubSub.default.pub("executeCommand", "sketch.edit"),
            });
        } else {
            items.push({
                display: "common.edit",
                icon: "icon-edit",
                onClick: () => {},
            });
        }
        items.push({
            display: "common.rename",
            icon: "icon-tag",
            onClick: this.startRename,
        });
        items.push({
            display: "common.delete",
            icon: "icon-delete",
            onClick: () => PubSub.default.pub("executeCommand", "modify.deleteNode"),
        });

        openContextMenu(e.clientX, e.clientY, items);
    };

    private readonly startRename = () => {
        const original = this.node.name;
        let cancelled = false;

        const selectAllText = () => {
            const range = document.createRange();
            range.selectNodeContents(this.name);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
        };

        const cleanup = () => {
            this.name.contentEditable = "false";
            this.name.classList.remove(style.editing);
            this.draggable = true;
            this.name.removeEventListener("keydown", onKeyDown);
            this.name.removeEventListener("blur", onBlur);
        };

        const onKeyDown = (e: KeyboardEvent) => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.preventDefault();
                this.name.blur();
            } else if (e.key === "Escape") {
                e.preventDefault();
                cancelled = true;
                this.name.blur();
            }
        };

        const onBlur = () => {
            cleanup();
            const value = (this.name.textContent ?? "").trim();
            if (cancelled || !value || value === original) {
                this.name.textContent = original;
                return;
            }
            Transaction.execute(this.document, "rename node", () => {
                this.node.name = value;
            });
        };

        this.draggable = false;
        this.name.contentEditable = "true";
        this.name.classList.add(style.editing);
        this.name.addEventListener("keydown", onKeyDown);
        this.name.addEventListener("blur", onBlur);
        this.name.focus();
        selectAllText();
    };
}
