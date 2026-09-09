// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    GetOrSelectNodeStep,
    type INode,
    type IStep,
    MultistepCommand,
    PubSub,
    Transaction,
} from "@chili3d/core";
import { LineNode } from "../../bodys/line";

/**
 * Flips `isConstruction` on every selected line, each independently (mixed
 * selections don't get forced to one state) - a construction line renders
 * dashed and is meant as a sketch reference/guide, not real profile geometry.
 */
@command({
    key: "modify.toggleConstruction",
    icon: "icon-constructionLine",
})
export class ToggleConstruction extends MultistepCommand {
    protected override executeMainTask(): void {
        const nodes: INode[] | undefined = this.stepDatas[0].nodes;
        const lines = nodes?.filter((n): n is LineNode => n instanceof LineNode) ?? [];
        if (lines.length === 0) {
            PubSub.default.pub("showToast", "toast.select.noSelected");
            return;
        }

        Transaction.execute(this.document, "toggle construction line", () => {
            lines.forEach((line) => {
                line.isConstruction = !line.isConstruction;
            });
        });
        this.document.visual.update();
    }

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.models", { multiple: true })];
    }
}
