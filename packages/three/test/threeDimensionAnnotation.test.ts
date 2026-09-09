// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { DimensionAnnotation, Matrix4, setDimensionEditHandler, XYZ } from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { ThreeDimensionAnnotation } from "../src/threeDimensionAnnotation";
import { createThreeMockVisualContext } from "./mocks";

function createLinearAnnotation(doc: TestDocument = new TestDocument()): DimensionAnnotation {
    return new DimensionAnnotation({
        document: doc,
        annotationType: "dimension",
        name: "Dimension",
        dimensionType: "linear",
        startPoint: new XYZ({ x: 0, y: 0, z: 0 }),
        endPoint: new XYZ({ x: 10, y: 0, z: 0 }),
        placement: new XYZ({ x: 5, y: 5, z: 0 }),
    });
}

function createRadialAnnotation(doc: TestDocument = new TestDocument()): DimensionAnnotation {
    return new DimensionAnnotation({
        document: doc,
        annotationType: "dimension",
        name: "Dimension",
        dimensionType: "radial",
        startPoint: XYZ.zero,
        endPoint: new XYZ({ x: 5, y: 0, z: 0 }),
        placement: new XYZ({ x: 0, y: 5, z: 0 }),
    });
}

function createDiameterAnnotation(doc: TestDocument = new TestDocument()): DimensionAnnotation {
    return new DimensionAnnotation({
        document: doc,
        annotationType: "dimension",
        name: "Dimension",
        dimensionType: "diameter",
        startPoint: XYZ.zero,
        endPoint: new XYZ({ x: 5, y: 0, z: 0 }),
        placement: new XYZ({ x: 0, y: 5, z: 0 }),
    });
}

function createAngleAnnotation(doc: TestDocument = new TestDocument()): DimensionAnnotation {
    return new DimensionAnnotation({
        document: doc,
        annotationType: "dimension",
        name: "Dimension",
        dimensionType: "angle",
        startPoint: XYZ.zero,
        endPoint: new XYZ({ x: 10, y: 0, z: 0 }),
        point2: new XYZ({ x: 0, y: 10, z: 0 }),
        placement: new XYZ({ x: 5, y: 5, z: 0 }),
    });
}

function labelText(annotation: ThreeDimensionAnnotation): string {
    return (annotation as any)._valueEl.textContent as string;
}

describe("ThreeDimensionAnnotation", () => {
    test("creates the object holding the given annotation", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createLinearAnnotation());

        expect(three.annotation.dimensionType).toBe("linear");
        expect(three.locked).toBe(false);
    });

    test("wholeVisual returns the dimension line mesh", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createLinearAnnotation());

        const visuals = three.wholeVisual();
        expect(visuals).toHaveLength(1);
    });

    test("label shows the linear distance between start and end", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createLinearAnnotation());

        expect(labelText(three)).toBe("10.00 mm");
    });

    test("label shows the radius for a radial dimension", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createRadialAnnotation());

        expect(labelText(three)).toBe("5.00 mm");
    });

    test("label shows the Ø-prefixed diameter for a diameter dimension", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createDiameterAnnotation());

        expect(labelText(three)).toBe("Ø10.00 mm");
    });

    test("a diameter dimension draws an extra arrowhead (both ends) compared to a radial one", () => {
        const context = createThreeMockVisualContext();
        const radial = new ThreeDimensionAnnotation(context, createRadialAnnotation());
        const diameter = new ThreeDimensionAnnotation(context, createDiameterAnnotation());

        const radialMesh = radial.wholeVisual()[0] as LineSegments2;
        const diameterMesh = diameter.wholeVisual()[0] as LineSegments2;

        // Radial: main line + 1 arrowhead (2 segments) = 3 segments.
        // Diameter: main line + 2 arrowheads (2 segments each) = 5 segments.
        expect(radialMesh.geometry.instanceCount).toBe(3);
        expect(diameterMesh.geometry.instanceCount).toBe(5);
    });

    test("a diameter dimension's line spans both edges through the center, not just center-to-edge", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createDiameterAnnotation());

        // createDiameterAnnotation: center at origin, radius 5, placement
        // along +Y - the full line should run from (0,-5,0) to (0,5,0).
        const positions = (three.wholeVisual()[0] as LineSegments2).geometry.attributes["instanceStart"]
            .array;
        const ys: number[] = [];
        for (let i = 1; i < positions.length; i += 3) ys.push(positions[i]);
        expect(Math.min(...ys)).toBeCloseTo(-5, 6);
        expect(Math.max(...ys)).toBeCloseTo(5, 6);
    });

    test("label shows the angle in degrees, not mm, for an angle dimension", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createAngleAnnotation());

        expect(labelText(three)).toBe("90.00°");
    });

    test("angle dimension's mesh rebuilds when point2 changes", () => {
        const doc = new TestDocument();
        const annotation = createAngleAnnotation(doc);
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, annotation);

        const meshBefore = three.wholeVisual()[0];
        expect(labelText(three)).toBe("90.00°");

        // Rotate the second edge out to 180 degrees from the first.
        annotation.point2 = new XYZ({ x: -10, y: 0, z: 0 });

        expect(labelText(three)).toBe("180.00°");
        expect(three.wholeVisual()[0]).not.toBe(meshBefore);
    });

    test("label prefers an explicit override value over the computed distance", () => {
        const doc = new TestDocument();
        const annotation = new DimensionAnnotation({
            document: doc,
            annotationType: "dimension",
            name: "Dimension",
            dimensionType: "linear",
            startPoint: XYZ.zero,
            endPoint: new XYZ({ x: 10, y: 0, z: 0 }),
            placement: new XYZ({ x: 5, y: 5, z: 0 }),
            value: 42,
        });
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, annotation);

        expect(labelText(three)).toBe("42.00 mm");
    });

    test("highlight/unhighlight swap the line material", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createLinearAnnotation());

        const mesh = three.wholeVisual()[0] as LineSegments2;
        const original = mesh.material;
        three.highlight();
        expect(mesh.material).not.toBe(original);
        three.unhighlight();
        expect(mesh.material).toBe(original);
    });

    test("worldTransform and transform default to identity", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createLinearAnnotation());

        expect(three.worldTransform().equals(Matrix4.identity())).toBe(true);
        expect(three.transform.equals(Matrix4.identity())).toBe(true);
    });

    test("boundingBox reflects the rendered mesh", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createLinearAnnotation());

        const box = three.boundingBox();
        expect(box).toBeDefined();
    });

    test("editing the underlying line's endpoint rebuilds the mesh and label live", () => {
        const doc = new TestDocument();
        const annotation = createLinearAnnotation(doc);
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, annotation);

        const meshBefore = three.wholeVisual()[0];
        expect(labelText(three)).toBe("10.00 mm");

        annotation.endPoint = new XYZ({ x: 20, y: 0, z: 0 });

        expect(labelText(three)).toBe("20.00 mm");
        expect(three.wholeVisual()[0]).not.toBe(meshBefore);
    });

    test("beginEdit does nothing (no input appears) when no edit handler is registered", () => {
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, createLinearAnnotation());
        const labelEl = (three as any)._labelEl as HTMLDivElement;

        labelEl.dispatchEvent(new Event("dblclick", { bubbles: true }));

        expect(labelEl.querySelector("input")).toBeNull();
    });

    test("beginEdit shows a prefilled input when an edit handler is registered", () => {
        const doc = new TestDocument();
        const annotation = createLinearAnnotation(doc);
        setDimensionEditHandler(annotation, () => true);
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, annotation);
        const labelEl = (three as any)._labelEl as HTMLDivElement;

        labelEl.dispatchEvent(new Event("dblclick", { bubbles: true }));

        const input = labelEl.querySelector("input");
        expect(input).not.toBeNull();
        expect(input!.value).toBe("10.0000");
    });

    test("Escape while editing cancels back to the plain label", () => {
        const doc = new TestDocument();
        const annotation = createLinearAnnotation(doc);
        setDimensionEditHandler(annotation, () => true);
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, annotation);
        const labelEl = (three as any)._labelEl as HTMLDivElement;

        labelEl.dispatchEvent(new Event("dblclick", { bubbles: true }));
        const input = labelEl.querySelector("input")!;
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

        expect(labelEl.querySelector("input")).toBeNull();
        expect(labelText(three)).toBe("10.00 mm");
    });

    test("dispose disposes the line geometry and detaches the property-changed listener", () => {
        const doc = new TestDocument();
        const annotation = createLinearAnnotation(doc);
        const context = createThreeMockVisualContext();
        const three = new ThreeDimensionAnnotation(context, annotation);

        const mesh = three.wholeVisual()[0] as LineSegments2;
        let disposed = false;
        mesh.geometry.addEventListener("dispose", () => {
            disposed = true;
        });

        three.dispose();
        expect(disposed).toBe(true);

        // After dispose, further property changes on the annotation should
        // not attempt to rebuild a detached object.
        const meshAfterDispose = three.wholeVisual()[0];
        annotation.endPoint = new XYZ({ x: 99, y: 0, z: 0 });
        expect(three.wholeVisual()[0]).toBe(meshAfterDispose);
    });
});
