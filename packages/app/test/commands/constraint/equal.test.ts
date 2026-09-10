// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { PubSub } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { EqualCommand } from "../../../src/commands/constraint/equal";
import { buildTwoLineSketch, vertexPick } from "./_utils";

describe("EqualCommand", () => {
    test("should have command metadata", () => {
        const data = (EqualCommand as any).prototype.data;
        expect(data.key).toBe("constraint.equal");
        expect(data.icon).toBe("icon-constraintEqual");
    });

    test("getSteps should return one step", () => {
        const cmd = new EqualCommand();
        expect((cmd as any).getSteps().length).toBe(1);
    });

    test("executeMainTask makes line2's length match line1's", () => {
        const { doc, sketch, line1, line2 } = buildTwoLineSketch();
        const cmd = new EqualCommand();
        (cmd as any)._application = { activeView: { document: doc } };
        (cmd as any).stepDatas = [
            {
                shapes: [
                    vertexPick(line1, line1.start),
                    vertexPick(line1, line1.end),
                    vertexPick(line2, line2.start),
                    vertexPick(line2, line2.end),
                ],
            },
        ];

        (cmd as any).executeMainTask();

        expect(sketch.constraints.length).toBe(1);
        const lengthA = line1.end.sub(line1.start).length();
        const lengthB = line2.end.sub(line2.start).length();
        expect(lengthB).toBeCloseTo(lengthA, 3);
    });

    test("shows a toast and adds no constraint when fewer than four points are picked", () => {
        const { doc, sketch, line1, line2 } = buildTwoLineSketch();
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const cmd = new EqualCommand();
            (cmd as any)._application = { activeView: { document: doc } };
            (cmd as any).stepDatas = [
                { shapes: [vertexPick(line1, line1.start), vertexPick(line2, line2.start)] },
            ];

            (cmd as any).executeMainTask();

            expect(toastMessage).toBe("toast.select.noSelected");
            expect(sketch.constraints.length).toBe(0);
        } finally {
            PubSub.default.pub = originalPub;
        }
    });
});
