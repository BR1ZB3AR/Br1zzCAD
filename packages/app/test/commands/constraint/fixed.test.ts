// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type FixedConstraint, PubSub } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { FixedCommand } from "../../../src/commands/constraint/fixed";
import { buildTwoLineSketch, vertexPick } from "./_utils";

describe("FixedCommand", () => {
    test("should have command metadata", () => {
        const data = (FixedCommand as any).prototype.data;
        expect(data.key).toBe("constraint.fixed");
        expect(data.icon).toBe("icon-constraintFixed");
    });

    test("getSteps should return one step", () => {
        const cmd = new FixedCommand();
        expect((cmd as any).getSteps().length).toBe(1);
    });

    test("executeMainTask pins the picked point to its current location", () => {
        const { doc, sketch, line1 } = buildTwoLineSketch();
        const cmd = new FixedCommand();
        (cmd as any)._application = { activeView: { document: doc } };
        (cmd as any).stepDatas = [{ shapes: [vertexPick(line1, line1.start)] }];

        (cmd as any).executeMainTask();

        expect(sketch.constraints.length).toBe(1);
        const constraint = sketch.constraints[0] as FixedConstraint;
        expect(constraint.kind).toBe("fixed");
        expect(constraint.u).toBeCloseTo(line1.start.x, 5);
        expect(constraint.v).toBeCloseTo(line1.start.y, 5);
    });

    test("shows a toast and adds no constraint when no point is picked", () => {
        const { doc, sketch } = buildTwoLineSketch();
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const cmd = new FixedCommand();
            (cmd as any)._application = { activeView: { document: doc } };
            (cmd as any).stepDatas = [{ shapes: [] }];

            (cmd as any).executeMainTask();

            expect(toastMessage).toBe("toast.select.noSelected");
            expect(sketch.constraints.length).toBe(0);
        } finally {
            PubSub.default.pub = originalPub;
        }
    });
});
