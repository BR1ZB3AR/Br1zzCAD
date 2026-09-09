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
        function createMockShapeWithEdges() {
            const edges = {
                lineType: "solid" as const,
                position: new Float32Array([0, 0, 0, 1, 1, 1]),
                range: [{ start: 0, count: 1 }],
                color: "#000000",
            };
            const shape = createMockShape();
            // BodyMockShape.mesh is a getter-only accessor, so it must be
            // replaced via defineProperty rather than a plain assignment.
            Object.defineProperty(shape, "mesh", {
                get: () => ({ edges, faces: undefined, vertexs: undefined }),
                configurable: true,
            });
            return shape;
        }

        test("should default to false", () => {
            const node = new LineNode({ document: doc, start, end });
            expect(node.isConstruction).toBe(false);
        });

        test("setting it should update the value", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            node.isConstruction = true;
            expect(node.isConstruction).toBe(true);
        });

        test("should emit onPropertyChanged", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            const handler = rs.fn((_property: string) => {});
            node.onPropertyChanged(handler);
            node.isConstruction = true;
            expect(handler.mock.calls.map((c) => c[0])).toContain("isConstruction");
        });

        test("createMesh should mark edges dashed when isConstruction is true from the start", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            node.isConstruction = true;
            // Force a fresh mesh build (isConstruction's setter already mutated the
            // cached one) to also verify createMesh() itself bakes it in correctly -
            // the path taken on document load, where the setter is never called.
            (node as any)._mesh = undefined;
            expect(node.mesh.edges?.lineType).toBe("dash");
        });

        test("createMesh should leave edges solid when isConstruction is false", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            expect(node.mesh.edges?.lineType).toBe("solid");
        });

        test("toggling on an already-built mesh mutates the cached mesh directly", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            const meshBefore = node.mesh;
            expect(meshBefore.edges?.lineType).toBe("solid");

            node.isConstruction = true;

            expect(node.mesh).toBe(meshBefore);
            expect(node.mesh.edges?.lineType).toBe("dash");
        });

        test("toggling back off restores a solid line", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            node.isConstruction = true;
            node.isConstruction = false;
            expect(node.mesh.edges?.lineType).toBe("solid");
        });

        test("should redraw the node's visual so the style change is visible immediately", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            const redrawNode = rs.fn();
            (doc.visual.context as any).redrawNode = redrawNode;

            node.isConstruction = true;

            expect(redrawNode).toHaveBeenCalledWith([node]);
        });

        test("setting the same value again should not redraw", () => {
            setupShapeFactoryMock({ line: () => Result.ok(createMockShapeWithEdges()) });
            const node = new LineNode({ document: doc, start, end });
            node.isConstruction = true;
            const redrawNode = rs.fn();
            (doc.visual.context as any).redrawNode = redrawNode;

            node.isConstruction = true;

            expect(redrawNode).not.toHaveBeenCalled();
        });
    });
});
