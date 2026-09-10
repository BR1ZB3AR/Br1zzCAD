// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { PubSub } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { CoincidentCommand } from "../../../src/commands/constraint/coincident";
import { buildTwoLineSketch, vertexPick } from "./_utils";

describe("CoincidentCommand", () => {
    test("should have command metadata", () => {
        const data = (CoincidentCommand as any).prototype.data;
        expect(data.key).toBe("constraint.coincident");
        expect(data.icon).toBe("icon-constraintCoincident");
    });

    test("getSteps should return one step", () => {
        const cmd = new CoincidentCommand();
        expect((cmd as any).getSteps().length).toBe(1);
    });

    test("executeMainTask joins two picked endpoints from different lines", () => {
        const { doc, sketch, line1, line2 } = buildTwoLineSketch();
        const cmd = new CoincidentCommand();
        (cmd as any)._application = { activeView: { document: doc } };
        (cmd as any).stepDatas = [{ shapes: [vertexPick(line1, line1.end), vertexPick(line2, line2.start)] }];

        (cmd as any).executeMainTask();

        expect(sketch.constraints.length).toBe(1);
        expect(line1.end.x).toBeCloseTo(line2.start.x, 5);
        expect(line1.end.y).toBeCloseTo(line2.start.y, 5);
    });

    test("shows a toast and adds no constraint when fewer than two points are picked", () => {
        const { doc, sketch, line1 } = buildTwoLineSketch();
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const cmd = new CoincidentCommand();
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
