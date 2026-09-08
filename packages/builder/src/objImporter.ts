// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { XYZLike } from "@chili3d/core";
import type { TriangleMesh } from "./meshShapeBuilder";

/**
 * Minimal Wavefront OBJ parser: reads `v` (vertex) and `f` (face) lines only,
 * ignoring normals/texture coordinates/materials/groups - this app only
 * needs the geometry to build a faceted shape. Faces with more than 3
 * vertices are fan-triangulated from their first vertex.
 */
export function parseObj(text: string): TriangleMesh {
    const vertices: XYZLike[] = [];
    const triangles: [number, number, number][] = [];

    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (line.startsWith("v ")) {
            const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number);
            vertices.push({ x, y, z });
        } else if (line.startsWith("f ")) {
            const indices = line
                .slice(2)
                .trim()
                .split(/\s+/)
                .map((token) => {
                    // A face reference is "v", "v/vt", "v/vt/vn", or "v//vn" -
                    // only the vertex index (before the first slash) matters here.
                    const v = Number(token.split("/")[0]);
                    // OBJ indices are 1-based; negative indices count back from
                    // the end of the vertex list seen so far.
                    return v > 0 ? v - 1 : vertices.length + v;
                });
            // Fan-triangulate polygons with more than 3 vertices.
            for (let i = 1; i < indices.length - 1; i++) {
                triangles.push([indices[0], indices[i], indices[i + 1]]);
            }
        }
    }

    return { vertices, triangles };
}
