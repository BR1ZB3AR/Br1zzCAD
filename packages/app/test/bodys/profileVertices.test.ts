// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IShape, ShapeTypes, XYZ } from "@chili3d/core";
import { describe, expect, test } from "@rstest/core";
import { withProfileVertices } from "../../src/bodys/profileVertices";

function mockVertex(point: XYZ) {
    return { point: () => point } as unknown as IShape;
}

function mockShape(vertices: XYZ[]): IShape {
    return {
        findSubShapes: (type: unknown) => (type === ShapeTypes.vertex ? vertices.map(mockVertex) : []),
    } as unknown as IShape;
}

describe("withProfileVertices", () => {
    test("returns the mesh unchanged if it already has vertex data", () => {
        const mesh = {
            edges: undefined,
            faces: undefined,
            vertexs: { position: new Float32Array(), range: [] },
        };
        const result = withProfileVertices(mesh as any, mockShape([XYZ.zero]));
        expect(result).toBe(mesh);
    });

    test("returns the mesh unchanged when the shape has no vertices and no extra points", () => {
        const mesh = { edges: undefined, faces: undefined, vertexs: undefined };
        const result = withProfileVertices(mesh as any, mockShape([]));
        expect(result.vertexs).toBeUndefined();
    });

    test("populates vertexs.position from the shape's topological vertices", () => {
        const mesh = { edges: undefined, faces: undefined, vertexs: undefined };
        const p0 = new XYZ({ x: 0, y: 0, z: 0 });
        const p1 = new XYZ({ x: 10, y: 0, z: 0 });
        const result = withProfileVertices(mesh as any, mockShape([p0, p1]));

        expect(result.vertexs).toBeDefined();
        expect(Array.from(result.vertexs!.position)).toEqual([0, 0, 0, 10, 0, 0]);
        expect(result.vertexs!.range).toHaveLength(2);
    });

    test("appends extra (non-topological) points after the shape's own vertices", () => {
        const mesh = { edges: undefined, faces: undefined, vertexs: undefined };
        const edgePoint = new XYZ({ x: 5, y: 0, z: 0 });
        const center = new XYZ({ x: 0, y: 0, z: 0 });
        const result = withProfileVertices(mesh as any, mockShape([edgePoint]), [center]);

        expect(Array.from(result.vertexs!.position)).toEqual([5, 0, 0, 0, 0, 0]);
        // Only the real topological vertex gets a pickable range entry.
        expect(result.vertexs!.range).toHaveLength(1);
    });

    test("still adds a marker for extra points even when the shape itself has no vertices", () => {
        const mesh = { edges: undefined, faces: undefined, vertexs: undefined };
        const center = new XYZ({ x: 1, y: 2, z: 3 });
        const result = withProfileVertices(mesh as any, mockShape([]), [center]);

        expect(Array.from(result.vertexs!.position)).toEqual([1, 2, 3]);
    });

    test("preserves the original edges/faces mesh data", () => {
        const mesh = { edges: { some: "edge-data" }, faces: { some: "face-data" }, vertexs: undefined };
        const result = withProfileVertices(mesh as any, mockShape([XYZ.zero]));

        expect(result.edges).toBe(mesh.edges);
        expect(result.faces).toBe(mesh.faces);
    });

    // Regression test: the real mesh passed in here is a `Mesher` instance
    // (packages/wasm/src/shape.ts) whose edges/faces/vertexs are defined as
    // prototype getters, not own properties. An earlier version of this
    // function did `{...mesh, vertexs: {...}}`, which silently drops
    // prototype-accessor properties (spread only copies own enumerable
    // ones) - edges/faces both came back `undefined`, and every sketch
    // profile shape's outline disappeared, leaving only the corner dots.
    test("preserves edges/faces when they're prototype getters, not own properties", () => {
        class MesherLike {
            get edges() {
                return { some: "edge-data" };
            }
            get faces() {
                return { some: "face-data" };
            }
            get vertexs() {
                return undefined;
            }
        }
        const mesh = new MesherLike();
        const result = withProfileVertices(mesh as any, mockShape([XYZ.zero]));

        expect(result.edges).toEqual({ some: "edge-data" });
        expect(result.faces).toEqual({ some: "face-data" });
        expect(result.vertexs).toBeDefined();
    });
});
