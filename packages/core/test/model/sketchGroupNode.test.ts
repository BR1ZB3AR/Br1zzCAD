// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IDocument, Plane, SketchGroupNode } from "../../src";
import { TestDocument } from "../../test-utils";

describe("SketchGroupNode", () => {
    const doc: IDocument = new TestDocument() as any;

    test("should set name, document and plane via constructor", () => {
        const node = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        expect(node.name).toBe("Sketch 1");
        expect(node.document).toBe(doc);
        expect(node.plane).toBe(Plane.XY);
    });

    test("should be a GroupNode with an independent working plane", () => {
        const xy = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });
        const zx = new SketchGroupNode({ document: doc, name: "Sketch 2", plane: Plane.ZX });
        expect(xy.plane).toBe(Plane.XY);
        expect(zx.plane).toBe(Plane.ZX);
        expect(xy.transform.equals(zx.transform)).toBe(true);
    });
});
