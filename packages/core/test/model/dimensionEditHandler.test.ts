// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { rs } from "@rstest/core";
import { XYZ } from "../../src/math";
import { DimensionAnnotation } from "../../src/model/annotation";
import { getDimensionEditHandler, setDimensionEditHandler } from "../../src/model/dimensionEditHandler";
import { TestDocument } from "../../test-utils";

function makeAnnotation(doc: unknown, name: string): DimensionAnnotation {
    return new DimensionAnnotation({
        document: doc as any,
        annotationType: "dimension",
        name,
        startPoint: XYZ.zero,
        endPoint: XYZ.unitX,
        placement: XYZ.unitY,
    });
}

describe("dimensionEditHandler", () => {
    const doc = new TestDocument() as any;

    test("getDimensionEditHandler should return undefined when none was set", () => {
        const anno = makeAnnotation(doc, "a");
        expect(getDimensionEditHandler(anno)).toBeUndefined();
    });

    test("setDimensionEditHandler should make the handler retrievable", () => {
        const anno = makeAnnotation(doc, "a");
        const handler = rs.fn((_value: number) => true);
        setDimensionEditHandler(anno, handler);

        expect(getDimensionEditHandler(anno)).toBe(handler);
    });

    test("handlers should be keyed per annotation instance", () => {
        const annoA = makeAnnotation(doc, "a");
        const annoB = makeAnnotation(doc, "b");
        const handlerA = rs.fn((_value: number) => true);
        setDimensionEditHandler(annoA, handlerA);

        expect(getDimensionEditHandler(annoA)).toBe(handlerA);
        expect(getDimensionEditHandler(annoB)).toBeUndefined();
    });

    test("setting a new handler on the same annotation should replace the old one", () => {
        const anno = makeAnnotation(doc, "a");
        const first = rs.fn((_value: number) => true);
        const second = rs.fn((_value: number) => false);
        setDimensionEditHandler(anno, first);
        setDimensionEditHandler(anno, second);

        expect(getDimensionEditHandler(anno)).toBe(second);
    });
});
