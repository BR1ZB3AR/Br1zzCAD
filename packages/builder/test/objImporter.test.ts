// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { parseObj } from "../src/objImporter";

describe("parseObj", () => {
    test("parses vertices and a triangular face", () => {
        const obj = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "f 1 2 3"].join("\n");

        const mesh = parseObj(obj);

        expect(mesh.vertices).toEqual([
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
        ]);
        expect(mesh.triangles).toEqual([[0, 1, 2]]);
    });

    test("fan-triangulates a quad face", () => {
        const obj = ["v 0 0 0", "v 1 0 0", "v 1 1 0", "v 0 1 0", "f 1 2 3 4"].join("\n");

        const mesh = parseObj(obj);

        expect(mesh.triangles).toEqual([
            [0, 1, 2],
            [0, 2, 3],
        ]);
    });

    test("reads only the vertex index from v/vt/vn face references", () => {
        const obj = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "f 1/1/1 2/2/2 3/3/3", "f 1//1 2//2 3//3"].join("\n");

        const mesh = parseObj(obj);

        expect(mesh.triangles).toEqual([
            [0, 1, 2],
            [0, 1, 2],
        ]);
    });

    test("resolves negative (relative) indices", () => {
        const obj = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "f -3 -2 -1"].join("\n");

        const mesh = parseObj(obj);

        expect(mesh.triangles).toEqual([[0, 1, 2]]);
    });

    test("ignores unrelated lines (comments, normals, texcoords, groups)", () => {
        const obj = [
            "# a comment",
            "vn 0 0 1",
            "vt 0.5 0.5",
            "o MyObject",
            "v 0 0 0",
            "v 1 0 0",
            "v 0 1 0",
            "g group1",
            "f 1 2 3",
        ].join("\n");

        const mesh = parseObj(obj);

        expect(mesh.vertices).toHaveLength(3);
        expect(mesh.triangles).toEqual([[0, 1, 2]]);
    });

    test("returns an empty mesh for empty input", () => {
        const mesh = parseObj("");

        expect(mesh.vertices).toEqual([]);
        expect(mesh.triangles).toEqual([]);
    });
});
