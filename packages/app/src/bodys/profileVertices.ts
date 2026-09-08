// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    type IShape,
    type IShapeMeshData,
    type ISubShape,
    type IVertex,
    ShapeTypes,
    VisualConfig,
    type XYZ,
} from "@chili3d/core";

/**
 * Augments a shape's mesh with a point marker at each of its vertices (plus
 * any extra points that aren't real topology, like a circle/ellipse's
 * center) - the kernel's own mesh data only ever includes points for a
 * literal single-Vertex shape, never for a Face/Wire's corners, so sketch
 * profile shapes (Rect, Circle, Line, ...) render with no visible endpoint/
 * corner nodes unless we add them here.
 */
export function withProfileVertices(
    mesh: IShapeMeshData,
    shape: IShape,
    extraPoints: XYZ[] = [],
): IShapeMeshData {
    if (mesh.vertexs) return mesh;

    const vertices = shape.findSubShapes(ShapeTypes.vertex);
    if (vertices.length === 0 && extraPoints.length === 0) return mesh;

    const count = vertices.length + extraPoints.length;
    const position = new Float32Array(count * 3);
    const range = vertices.map((v, i) => {
        const point = (v as IVertex).point();
        position[i * 3] = point.x;
        position[i * 3 + 1] = point.y;
        position[i * 3 + 2] = point.z;
        return {
            start: i,
            count: 1,
            shape: Object.assign(v, { index: i, parent: shape }) as ISubShape,
        };
    });
    extraPoints.forEach((point, j) => {
        const i = vertices.length + j;
        position[i * 3] = point.x;
        position[i * 3 + 1] = point.y;
        position[i * 3 + 2] = point.z;
    });

    // Read edges/faces by explicit property access, not `{...mesh}` - the
    // real mesh here is a Mesher instance whose edges/faces/vertexs are
    // prototype getters, which a spread silently drops (it only copies own
    // enumerable properties), leaving both undefined.
    return {
        edges: mesh.edges,
        faces: mesh.faces,
        vertexs: {
            position,
            color: VisualConfig.defaultEdgeColor,
            size: 6,
            range,
        },
    };
}
