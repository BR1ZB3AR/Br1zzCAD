// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument } from "@chili3d/core";
import { Result, XYZ } from "@chili3d/core";
import { createMockDocument } from "@chili3d/core/test-utils";
import { beforeEach, describe, expect, rs, test } from "@rstest/core";
import { LineNode } from "../../src/bodys/line";
import { createMockShape, setupShapeFactoryMock } from "./_utils";

describe("LineNode", () => {
    let doc: IDocument;
    const start = XYZ.zero;
    const end = new XYZ({ x: 10, y: 10, z: 10 });

    beforeEach(() => {
        doc = createMockDocument();
    });

    describe("constructor", () => {
        test("should initialize start and end", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.start).toBe(start);
            expect(node.end).toBe(end);
        });

        test("should set name from display()", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.name).toBe("body.line");
        });
    });

    describe("display", () => {
        test("should return body.line", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.display()).toBe("body.line");
        });
    });

    describe("getters", () => {
        test("should return start and end", () => {
            const s = new XYZ({ x: 1, y: 2, z: 3 });
            const e = new XYZ({ x: 4, y: 5, z: 6 });
            const node = new LineNode({ document: doc, start: s, end: e });
            expect(node.start).toBe(s);
            expect(node.end).toBe(e);
        });
    });

    describe("setters", () => {
        test("setting start should update value", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            const node = new LineNode({ document: doc, start, end });
            const ns = new XYZ({ x: 1, y: 1, z: 1 });
            node.start = ns;
            expect(node.start).toBe(ns);
        });

        test("setting end should update value", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            const node = new LineNode({ document: doc, start, end });
            const ne = new XYZ({ x: 99, y: 99, z: 99 });
            node.end = ne;
            expect(node.end).toBe(ne);
        });
    });

    describe("onPropertyChanged", () => {
        test("should emit on start change", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            const node = new LineNode({ document: doc, start, end });
            const handler = rs.fn((_property: string) => {});
            node.onPropertyChanged(handler);
            node.start = new XYZ({ x: 5, y: 5, z: 5 });
            expect(handler.mock.calls.map((c) => c[0])).toContain("start");
        });

        test("should emit on end change", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            const node = new LineNode({ document: doc, start, end });
            const handler = rs.fn((_property: string) => {});
            node.onPropertyChanged(handler);
            node.end = new XYZ({ x: 7, y: 7, z: 7 });
            expect(handler.mock.calls.map((c) => c[0])).toContain("end");
        });
    });

    describe("generateShape", () => {
        test("should call shapeFactory.line", () => {
            const line = rs.fn(() => Result.ok(createMockShape()));
            setupShapeFactoryMock({ line });
            const node = new LineNode({ document: doc, start, end });
            node.generateShape();
            expect(line).toHaveBeenCalledWith(start, end);
        });

        test("should return Result.err when shapeFactory.line fails", () => {
            setupShapeFactoryMock({
                line: () => Result.err("line creation failed"),
            });
            const node = new LineNode({ document: doc, start, end });
            const result = node.generateShape();
            expect(result.isOk).toBe(false);
        });
    });

    describe("isConstruction", () => {
        // Full behavioral coverage (dash/color baking, redraw, no-op on an
        // unchanged value, ...) lives in core's shapeNode.test.ts, since
        // isConstruction is defined on the shared ShapeNode base now - this
        // just confirms LineNode actually inherits it.
        test("should default to false and be settable", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.isConstruction).toBe(false);

            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            node.isConstruction = true;
            expect(node.isConstruction).toBe(true);
        });
    });

    describe("ISketchPointOwner", () => {
        test("sketchPointRoles returns start and end", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.sketchPointRoles()).toEqual(["start", "end"]);
        });

        test("getSketchPoint returns the matching point for each role", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.getSketchPoint("start")).toBe(start);
            expect(node.getSketchPoint("end")).toBe(end);
        });

        test("getSketchPoint returns undefined for an unknown role", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.getSketchPoint("center")).toBeUndefined();
        });

        test("setSketchPoint updates start", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            const node = new LineNode({ document: doc, start, end });
            const moved = new XYZ({ x: 9, y: 9, z: 9 });
            node.setSketchPoint("start", moved);
            expect(node.start).toBe(moved);
        });

        test("setSketchPoint updates end", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShape()) });
            const node = new LineNode({ document: doc, start, end });
            const moved = new XYZ({ x: 8, y: 8, z: 8 });
            node.setSketchPoint("end", moved);
            expect(node.end).toBe(moved);
        });

        test("setSketchPoint is a no-op for an unknown role", () => {
            const node = new LineNode({ document: doc, start, end });
            node.setSketchPoint("center", new XYZ({ x: 1, y: 1, z: 1 }));
            expect(node.start).toBe(start);
            expect(node.end).toBe(end);
        });
    });
});
