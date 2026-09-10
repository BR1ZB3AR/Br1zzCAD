// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { PubSub } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { PerpendicularCommand } from "../../../src/commands/constraint/perpendicular";
import { buildTwoLineSketch, vertexPick } from "./_utils";

describe("PerpendicularCommand", () => {
    test("should have command metadata", () => {
        const data = (PerpendicularCommand as any).prototype.data;
        expect(data.key).toBe("constraint.perpendicular");
        expect(data.icon).toBe("icon-constraintPerpendicular");
    });

    test("getSteps should return one step", () => {
        const cmd = new PerpendicularCommand();
        expect((cmd as any).getSteps().length).toBe(1);
    });

    test("executeMainTask makes line2 perpendicular to line1", () => {
        const { doc, sketch, line1, line2 } = buildTwoLineSketch();
        const cmd = new PerpendicularCommand();
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
        const dirA = line1.end.sub(line1.start);
        const dirB = line2.end.sub(line2.start);
        const dot = dirA.x * dirB.x + dirA.y * dirB.y;
        expect(dot).toBeCloseTo(0, 3);
    });

    test("shows a toast and adds no constraint when fewer than four points are picked", () => {
        const { doc, sketch, line1, line2 } = buildTwoLineSketch();
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const cmd = new PerpendicularCommand();
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
