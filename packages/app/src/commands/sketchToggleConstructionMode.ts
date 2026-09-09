// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Binding, Config, command, type IApplication, type ICommand } from "@chili3d/core";

/**
 * While on, every sketch shape drawn next (Line, Rect, Circle, Arc, ...) is
 * created as construction geometry from the start - `CreateCommand` reads
 * `Config.instance.constructionMode` right after building the node. Mirrors
 * `workingPlane.toggleDynamic`'s pattern: a plain boolean flip, with the
 * ribbon button's pressed/active look driven by the `toggle` binding rather
 * than any state kept here.
 */
@command({
    key: "sketch.toggleConstructionMode",
    toggle: new Binding(Config.instance, "constructionMode"),
    icon: "icon-constructionLine",
})
export class ToggleConstructionMode implements ICommand {
    async execute(_app: IApplication): Promise<void> {
        Config.instance.constructionMode = !Config.instance.constructionMode;
    }
}
