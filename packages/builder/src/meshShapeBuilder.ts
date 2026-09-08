// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IFace, type IShape, Result, type XYZLike } from "@chili3d/core";

export interface TriangleMesh {
    vertices: XYZLike[];
    triangles: readonly (readonly [number, number, number])[];
}

/**
 * Cap on triangle count for the pure-JS mesh import path (OBJ, 3MF). OCCT has
 * no built-in reader for either format in this build, so unlike STL/STEP
 * (parsed in one native C++ pass), each triangle here costs two WASM calls
 * (polygon + face); very large meshes would take a long time and block the
 * UI thread. Raise this if that tradeoff turns out to be worth it.
 */
export const MAX_MESH_IMPORT_TRIANGLES = 20000;

/**
 * Builds a faceted IShape from a raw triangle mesh. Each triangle becomes its
 * own planar face; degenerate triangles are skipped rather than failing the
 * whole import. The faces are combined into a shell when they form a
 * consistent one, falling back to a compound for open/non-manifold meshes
 * (common in arbitrary OBJ/3MF files) rather than failing outright.
 */
export function buildFacetedShape(mesh: TriangleMesh): Result<IShape> {
    if (mesh.triangles.length === 0) {
        return Result.err("Mesh has no triangles");
    }
    if (mesh.triangles.length > MAX_MESH_IMPORT_TRIANGLES) {
        return Result.err(
            `Mesh has ${mesh.triangles.length} triangles, which exceeds the ${MAX_MESH_IMPORT_TRIANGLES} supported for this import path`,
        );
    }

    const faces: IFace[] = [];
    for (const [a, b, c] of mesh.triangles) {
        const face = buildTriangleFace(mesh.vertices[a], mesh.vertices[b], mesh.vertices[c]);
        if (face) faces.push(face);
    }

    if (faces.length === 0) {
        return Result.err("No valid (non-degenerate) triangles found in mesh");
    }

    const shell = shapeFactory.shell(faces);
    const result: Result<IShape> = shell.isOk ? Result.ok(shell.value) : shapeFactory.combine(faces);
    for (const f of faces) {
        f.dispose();
    }
    return result;
}

function buildTriangleFace(p1: XYZLike, p2: XYZLike, p3: XYZLike): IFace | undefined {
    if (!p1 || !p2 || !p3) return undefined;
    const wire = shapeFactory.polygon([p1, p2, p3]);
    if (!wire.isOk) return undefined;
    const face = shapeFactory.face([wire.value]);
    wire.value.dispose();
    return face.isOk ? face.value : undefined;
}
