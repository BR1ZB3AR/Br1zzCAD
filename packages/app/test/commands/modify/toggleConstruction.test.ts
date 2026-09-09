// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { PubSub, Result, Transaction, XYZ } from "@chili3d/core";
import { createMockDocument } from "@chili3d/core/test-utils";
import { describe, expect, test } from "@rstest/core";
import { LineNode } from "../../../src/bodys/line";
import { ToggleConstruction } from "../../../src/commands/modify/toggleConstruction";
import { createMockShape, setupShapeFactoryMock } from "../../bodys/_utils";

function stubTransaction() {
    const original = Transaction.execute;
    Transaction.execute = ((_doc: unknown, _label: string, fn: () => void) => {
        fn();
    }) as typeof Transaction.execute;
    return () => {
        Transaction.execute = original;
    };
}

describe("ToggleConstruction", () => {
    test("should have command metadata", () => {
        const data = (ToggleConstruction as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("modify.toggleConstruction");
        expect(data.icon).toBe("icon-constructionLine");
    });

    test("getSteps should return one step", () => {
        const cmd = new ToggleConstruction();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(1);
    });

    test("executeMainTask should flip isConstruction on every selected line", () => {
        const restoreTx = stubTransaction();
        try {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            const doc = createMockDocument();
            const line1 = new LineNode({
                document: doc,
                start: XYZ.zero,
                end: new XYZ({ x: 1, y: 0, z: 0 }),
            });
            const line2 = new LineNode({
                document: doc,
                start: XYZ.zero,
                end: new XYZ({ x: 0, y: 1, z: 0 }),
            });
            line2.isConstruction = true;

            const cmd = new ToggleConstruction();
            (cmd as any)._application = { activeView: { document: doc } };
            (cmd as any).stepDatas = [{ nodes: [line1, line2] }];
            (cmd as any).executeMainTask();

            expect(line1.isConstruction).toBe(true);
            expect(line2.isConstruction).toBe(false);
        } finally {
            restoreTx();
        }
    });

    test("should ignore non-LineNode selections", () => {
        const restoreTx = stubTransaction();
        try {
            const doc = createMockDocument();
            const notALine = { name: "not-a-line" };

            const cmd = new ToggleConstruction();
            (cmd as any)._application = { activeView: { document: doc } };
            (cmd as any).stepDatas = [{ nodes: [notALine] }];

            expect(() => (cmd as any).executeMainTask()).not.toThrow();
        } finally {
            restoreTx();
        }
    });

    test("should show a toast and do nothing when nothing is selected", () => {
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const doc = createMockDocument();
            const cmd = new ToggleConstruction();
            (cmd as any)._application = { activeView: { document: doc } };
            (cmd as any).stepDatas = [{ nodes: [] }];
            (cmd as any).executeMainTask();

            expect(toastMessage).toBe("toast.select.noSelected");
        } finally {
            PubSub.default.pub = originalPub;
        }
    });

    test("should show a toast when the selection has no lines at all", () => {
        let toastMessage = "";
        const originalPub = PubSub.default.pub;
        PubSub.default.pub = ((channel: string, message: string) => {
            if (channel === "showToast") toastMessage = message;
        }) as any;

        try {
            const doc = createMockDocument();
            const cmd = new ToggleConstruction();
            (cmd as any)._application = { activeView: { document: doc } };
            (cmd as any).stepDatas = [{ nodes: [{ name: "not-a-line" }] }];
            (cmd as any).executeMainTask();

            expect(toastMessage).toBe("toast.select.noSelected");
        } finally {
            PubSub.default.pub = originalPub;
        }
    });
});
