// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type DistanceConstraint, PubSub } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { DistanceCommand } from "../../../src/commands/constraint/distance";
import { buildTwoLineSketch, vertexPick } from "./_utils";

describe("DistanceCommand", () => {
    test("should have command metadata", () => {
        const data = (DistanceCommand as any).prototype.data;
        expect(data.key).toBe("constraint.distance");
        expect(data.icon).toBe("icon-constraintDistance");
    });

    test("getSteps should return one step", () => {
        const cmd = new DistanceCommand();
        expect((cmd as any).getSteps().length).toBe(1);
    });

    test("executeMainTask pins the picked points' current distance as the constraint's value", () => {
        const { doc, sketch, line1, line2 } = buildTwoLineSketch();
        const cmd = new DistanceCommand();
        (cmd as any)._application = { activeView: { document: doc } };
        (cmd as any).stepDatas = [{ shapes: [vertexPick(line1, line1.end), vertexPick(line2, line2.start)] }];

        (cmd as any).executeMainTask();

        expect(sketch.constraints.length).toBe(1);
        const constraint = sketch.constraints[0] as DistanceConstraint;
        expect(constraint.kind).toBe("distance");
        expect(constraint.distance).toBeCloseTo(line1.end.distanceTo(line2.start), 5);
    });

    test("shows a toast and adds no constraint when fewer than two points are picked", () => {
        const { doc, sketch, line1 } = buildTwoLineSketch();
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const cmd = new DistanceCommand();
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
