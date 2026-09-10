// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { PubSub } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { VerticalCommand } from "../../../src/commands/constraint/vertical";
import { buildTwoLineSketch, vertexPick } from "./_utils";

describe("VerticalCommand", () => {
    test("should have command metadata", () => {
        const data = (VerticalCommand as any).prototype.data;
        expect(data.key).toBe("constraint.vertical");
        expect(data.icon).toBe("icon-constraintVertical");
    });

    test("getSteps should return one step", () => {
        const cmd = new VerticalCommand();
        expect((cmd as any).getSteps().length).toBe(1);
    });

    test("executeMainTask aligns a line's own two endpoints on one x", () => {
        const { doc, sketch, line2 } = buildTwoLineSketch();
        // line2 starts non-vertical (x: 20 -> 30).
        const cmd = new VerticalCommand();
        (cmd as any)._application = { activeView: { document: doc } };
        (cmd as any).stepDatas = [{ shapes: [vertexPick(line2, line2.start), vertexPick(line2, line2.end)] }];

        (cmd as any).executeMainTask();

        expect(sketch.constraints.length).toBe(1);
        expect(line2.start.x).toBeCloseTo(line2.end.x, 5);
    });

    test("shows a toast and adds no constraint when fewer than two points are picked", () => {
        const { doc, sketch, line1 } = buildTwoLineSketch();
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const cmd = new VerticalCommand();
            (cmd as any)._application = { activeView: { document: doc } };
            (cmd as any).stepDatas = [{ shapes: [vertexPick(line1, line1.start)] }];

            (cmd as any).executeMainTask();

            expect(toastMessage).toBe("toast.select.noSelected");
            expect(sketch.constraints.length).toBe(0);
        } finally {
            PubSub.default.pub = originalPub;
        }
    });
});
