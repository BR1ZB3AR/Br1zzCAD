// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IFace, type IShape, type IWire, Result } from "@chili3d/core";
import { rs } from "@rstest/core";
import { buildFacetedShape, MAX_MESH_IMPORT_TRIANGLES, type TriangleMesh } from "../src/meshShapeBuilder";

function mockFace(id: string): IFace {
    return { id, dispose: rs.fn() } as unknown as IFace;
}

function mockWire(id: string): IWire {
    return { id, dispose: rs.fn() } as unknown as IWire;
}

function mockShape(id: string): IShape {
    return { id } as unknown as IShape;
}

describe("buildFacetedShape", () => {
    afterEach(() => {
        rs.unstubAllGlobals();
    });

    test("returns an error for an empty mesh", () => {
        const mesh: TriangleMesh = { vertices: [], triangles: [] };

        const result = buildFacetedShape(mesh);

        expect(result.isOk).toBe(false);
    });

    test("returns an error when the triangle count exceeds the cap", () => {
        const vertices = [{ x: 0, y: 0, z: 0 }];
        const triangles = Array.from({ length: MAX_MESH_IMPORT_TRIANGLES + 1 }, () => [0, 0, 0] as const);
        const mesh: TriangleMesh = { vertices, triangles };

        const result = buildFacetedShape(mesh);

        expect(result.isOk).toBe(false);
        expect(result.error).toContain(String(MAX_MESH_IMPORT_TRIANGLES));
    });

    test("builds one polygon+face per triangle, then a shell from all faces", () => {
        const polygon = rs.fn((_pts: unknown[]) => Result.ok(mockWire("w")));
        const faceMocks = [mockFace("f0"), mockFace("f1")];
        let faceCall = 0;
        const face = rs.fn((_wires: unknown[]) => Result.ok(faceMocks[faceCall++]));
        const shellResult = mockShape("shell");
        const shell = rs.fn((_faces: unknown[]) => Result.ok(shellResult));
        const combine = rs.fn();
        rs.stubGlobal("shapeFactory", { polygon, face, shell, combine });

        const mesh: TriangleMesh = {
            vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                { x: 1, y: 1, z: 0 },
            ],
            triangles: [
                [0, 1, 2],
                [1, 3, 2],
            ],
        };

        const result = buildFacetedShape(mesh);

        expect(result.isOk).toBe(true);
        expect(result.value).toBe(shellResult);
        expect(polygon).toHaveBeenCalledTimes(2);
        expect(face).toHaveBeenCalledTimes(2);
        expect(shell).toHaveBeenCalledTimes(1);
        expect(shell.mock.calls[0][0]).toEqual(faceMocks);
        expect(combine).not.toHaveBeenCalled();
        for (const f of faceMocks) {
            expect(f.dispose).toHaveBeenCalledTimes(1);
        }
    });

    test("falls back to a compound when the faces don't form a closed shell", () => {
        const wire = mockWire("w");
        const polygon = rs.fn((_pts: { x: number; y: number; z: number }[]) => Result.ok(wire));
        const triFace = mockFace("f0");
        const face = rs.fn((_wires: IWire[]) => Result.ok(triFace));
        const shell = rs.fn((_faces: IFace[]) => Result.err("open shell"));
        const compoundResult = mockShape("compound");
        const combine = rs.fn((_faces: IFace[]) => Result.ok(compoundResult));
        rs.stubGlobal("shapeFactory", { polygon, face, shell, combine });

        const mesh: TriangleMesh = {
            vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
            ],
            triangles: [[0, 1, 2]],
        };

        const result = buildFacetedShape(mesh);

        expect(result.isOk).toBe(true);
        expect(result.value).toBe(compoundResult);
        expect(combine).toHaveBeenCalledTimes(1);
        expect(combine.mock.calls[0][0]).toEqual([triFace]);
        expect(triFace.dispose).toHaveBeenCalledTimes(1);
    });

    test("skips a degenerate triangle (polygon build fails) instead of failing the import", () => {
        const goodWire = mockWire("w-good");
        const polygon = rs.fn((pts: { x: number }[]) =>
            pts[0].x === 0 && pts[1].x === 0 && pts[2].x === 0
                ? Result.err("degenerate")
                : Result.ok(goodWire),
        );
        const goodFace = mockFace("f-good");
        const face = rs.fn((_wires: IWire[]) => Result.ok(goodFace));
        const shellResult = mockShape("shell");
        const shell = rs.fn((_faces: IFace[]) => Result.ok(shellResult));
        const combine = rs.fn();
        rs.stubGlobal("shapeFactory", { polygon, face, shell, combine });

        const mesh: TriangleMesh = {
            vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
            ],
            triangles: [
                [0, 1, 2], // degenerate: all three vertices identical
                [0, 3, 4],
            ],
        };

        const result = buildFacetedShape(mesh);

        expect(result.isOk).toBe(true);
        expect(polygon).toHaveBeenCalledTimes(2);
        expect(face).toHaveBeenCalledTimes(1);
        expect(shell.mock.calls[0][0]).toEqual([goodFace]);
    });

    test("returns an error when every triangle is degenerate", () => {
        const polygon = rs.fn((_pts: { x: number; y: number; z: number }[]) => Result.err("degenerate"));
        const face = rs.fn((_wires: IWire[]) => Result.err("unreachable"));
        const shell = rs.fn((_faces: IFace[]) => Result.err("unreachable"));
        const combine = rs.fn((_faces: IFace[]) => Result.err("unreachable"));
        rs.stubGlobal("shapeFactory", { polygon, face, shell, combine });

        const mesh: TriangleMesh = {
            vertices: [{ x: 0, y: 0, z: 0 }],
            triangles: [[0, 0, 0]],
        };

        const result = buildFacetedShape(mesh);

        expect(result.isOk).toBe(false);
        expect(face).not.toHaveBeenCalled();
        expect(shell).not.toHaveBeenCalled();
    });
});
