// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { estimateStlTriangleCount } from "../src/stlTriangleCount";

function makeBinaryStl(triangleCount: number, header = "binary stl"): Uint8Array {
    const buf = new Uint8Array(84 + triangleCount * 50);
    const view = new DataView(buf.buffer);
    const headerBytes = new TextEncoder().encode(header);
    buf.set(headerBytes.subarray(0, 80), 0);
    view.setUint32(80, triangleCount, true);
    return buf;
}

function makeAsciiStl(triangleCount: number): Uint8Array {
    let text = "solid test\n";
    for (let i = 0; i < triangleCount; i++) {
        text +=
            "facet normal 0 0 1\n" +
            "  outer loop\n" +
            "    vertex 0 0 0\n" +
            "    vertex 1 0 0\n" +
            "    vertex 0 1 0\n" +
            "  endloop\n" +
            "endfacet\n";
    }
    text += "endsolid test\n";
    return new TextEncoder().encode(text);
}

describe("estimateStlTriangleCount", () => {
    test("reads the triangle count directly from a binary STL header", () => {
        const stl = makeBinaryStl(12345);

        expect(estimateStlTriangleCount(stl)).toBe(12345);
    });

    test("reads a binary STL correctly even when its header text says 'solid'", () => {
        // A legal but confusing binary STL: header starts with "solid ",
        // which is not enough on its own to mean "this is ASCII".
        const stl = makeBinaryStl(500, "solid exported-from-some-tool");

        expect(estimateStlTriangleCount(stl)).toBe(500);
    });

    test("counts 'facet normal' occurrences in an ASCII STL", () => {
        const stl = makeAsciiStl(7);

        expect(estimateStlTriangleCount(stl)).toBe(7);
    });

    test("returns undefined (indistinguishable from non-STL text) for an empty ASCII STL", () => {
        // No "facet normal" occurrences to count - genuinely ambiguous with
        // "not an STL at all". Either way the real import is left to decide,
        // since an empty mesh is never over the triangle cap regardless.
        const stl = new TextEncoder().encode("solid empty\nendsolid empty\n");

        expect(estimateStlTriangleCount(stl)).toBeUndefined();
    });

    test("returns undefined for content that is neither valid binary nor recognizable ASCII", () => {
        const stl = new TextEncoder().encode("not an stl file at all");

        expect(estimateStlTriangleCount(stl)).toBeUndefined();
    });

    test("handles a buffer too short to contain a binary header (falls through to ASCII counting)", () => {
        const stl = new TextEncoder().encode("facet normal 0 0 1");

        expect(estimateStlTriangleCount(stl)).toBe(1);
    });

    test("reads correctly from a Uint8Array view with a non-zero byteOffset", () => {
        const inner = makeBinaryStl(42);
        const padded = new Uint8Array(10 + inner.byteLength);
        padded.set(inner, 10);
        const view = padded.subarray(10);

        expect(estimateStlTriangleCount(view)).toBe(42);
    });
});
