// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { XYZLike } from "@chili3d/core";
import type { TriangleMesh } from "./meshShapeBuilder";

type PointTransform = (p: XYZLike) => XYZLike;

/**
 * Reads the mesh geometry out of a 3MF package (a zip archive containing
 * 3D/3dmodel.model, an XML document) - OCCT has no built-in 3MF reader, so
 * this is a from-scratch reader for just the geometry. Materials, colors, and
 * print tickets are ignored. Every <object><mesh> referenced by a <build>
 * <item> is merged into one combined mesh, applying that item's transform
 * (a 3MF transform is a row-major 3x4 affine matrix) if present. If the
 * package has no <build> section (unusual, but tolerated), every object's
 * mesh is merged untransformed instead.
 */
export async function parse3mf(file: File): Promise<TriangleMesh> {
    const JSZip = await import("jszip");
    const zip = await JSZip.default.loadAsync(file);
    const modelFile = zip.file("3D/3dmodel.model") ?? zip.file(/3dmodel\.model$/i).at(0);
    if (!modelFile) {
        throw new Error("3D/3dmodel.model not found in 3MF package");
    }

    const xmlText = await modelFile.async("text");
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.getElementsByTagName("parsererror").length > 0) {
        throw new Error("3D/3dmodel.model is not valid XML");
    }

    const meshesById = new Map<string, TriangleMesh>();
    for (const objectEl of Array.from(xml.getElementsByTagName("object"))) {
        const id = objectEl.getAttribute("id");
        const meshEl = objectEl.getElementsByTagName("mesh")[0];
        if (!id || !meshEl) continue;
        meshesById.set(id, readMesh(meshEl));
    }

    const items = Array.from(xml.getElementsByTagName("item"));
    const merged: TriangleMesh = { vertices: [], triangles: [] };
    if (items.length > 0) {
        for (const itemEl of items) {
            const objectId = itemEl.getAttribute("objectid");
            const mesh = objectId ? meshesById.get(objectId) : undefined;
            if (!mesh) continue;
            appendMesh(merged, mesh, parseTransform(itemEl.getAttribute("transform")));
        }
    } else {
        for (const mesh of meshesById.values()) {
            appendMesh(merged, mesh);
        }
    }

    return merged;
}

function readMesh(meshEl: Element): TriangleMesh {
    const vertices: XYZLike[] = [];
    const verticesEl = meshEl.getElementsByTagName("vertices")[0];
    if (verticesEl) {
        for (const v of Array.from(verticesEl.getElementsByTagName("vertex"))) {
            vertices.push({
                x: Number(v.getAttribute("x")),
                y: Number(v.getAttribute("y")),
                z: Number(v.getAttribute("z")),
            });
        }
    }

    const triangles: [number, number, number][] = [];
    const trianglesEl = meshEl.getElementsByTagName("triangles")[0];
    if (trianglesEl) {
        for (const t of Array.from(trianglesEl.getElementsByTagName("triangle"))) {
            triangles.push([
                Number(t.getAttribute("v1")),
                Number(t.getAttribute("v2")),
                Number(t.getAttribute("v3")),
            ]);
        }
    }

    return { vertices, triangles };
}

function parseTransform(raw: string | null): PointTransform | undefined {
    if (!raw) return undefined;
    const m = raw.trim().split(/\s+/).map(Number);
    if (m.length !== 12 || m.some(Number.isNaN)) return undefined;
    const [m00, m01, m02, m10, m11, m12, m20, m21, m22, m30, m31, m32] = m;
    return (p: XYZLike) => ({
        x: p.x * m00 + p.y * m10 + p.z * m20 + m30,
        y: p.x * m01 + p.y * m11 + p.z * m21 + m31,
        z: p.x * m02 + p.y * m12 + p.z * m22 + m32,
    });
}

function appendMesh(target: TriangleMesh, source: TriangleMesh, transform?: PointTransform) {
    const offset = target.vertices.length;
    const targetVertices = target.vertices as XYZLike[];
    const targetTriangles = target.triangles as [number, number, number][];
    for (const v of source.vertices) {
        targetVertices.push(transform ? transform(v) : v);
    }
    for (const [a, b, c] of source.triangles) {
        targetTriangles.push([a + offset, b + offset, c + offset]);
    }
}
