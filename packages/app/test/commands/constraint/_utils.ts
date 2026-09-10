// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type INode,
    Matrix4,
    Plane,
    Result,
    ShapeTypes,
    SketchGroupNode,
    type VisualShapeData,
    XYZ,
} from "@chili3d/core";
import { createMockDocument } from "@chili3d/core/test-utils";
import { LineNode } from "../../../src/bodys/line";
import { createMockShape, setupShapeFactoryMock } from "../../bodys/_utils";

/** A picked vertex, as a constraint command's step would receive it -
 * `.point()` is all `resolveSketchPointHandle` reads off the shape. */
export function vertexPick(node: INode, point: XYZ): VisualShapeData {
    return {
        shape: { shapeType: ShapeTypes.vertex, point: () => point } as any,
        owner: { node },
        transform: Matrix4.identity(),
        indexes: [],
    } as unknown as VisualShapeData;
}

/** A document + sketch + two LineNodes wired up the way a real sketch
 * session would produce them, for exercising a constraint command's
 * `executeMainTask` end-to-end (selection -> constraint -> solve). */
export function buildTwoLineSketch() {
    setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
    const doc = createMockDocument();
    const sketch = new SketchGroupNode({ document: doc, name: "Sketch 1", plane: Plane.XY });

    const line1 = new LineNode({
        document: doc,
        start: new XYZ({ x: 0, y: 0, z: 0 }),
        end: new XYZ({ x: 10, y: 0, z: 0 }),
    });
    const line2 = new LineNode({
        document: doc,
        start: new XYZ({ x: 20, y: 20, z: 0 }),
        end: new XYZ({ x: 30, y: 25, z: 0 }),
    });
    sketch.add(line1, line2);

    return { doc, sketch, line1, line2 };
}
