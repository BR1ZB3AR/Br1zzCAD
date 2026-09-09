// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { ShapeTypes } from "@chili3d/core";
import { Box3, Mesh, MeshBasicMaterial, Points } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { defaultEdgeMaterial } from "../src/materials";
import { ThreeGeometry } from "../src/threeGeometry";
import type { ThreeVisualContext } from "../src/threeVisualContext";
import { createTestGeometryNode, createThreeMockVisualContext } from "./mocks";

describe("ThreeGeometry", () => {
    let context: ThreeVisualContext;

    beforeEach(() => {
        context = createThreeMockVisualContext();
    });

    describe("construction", () => {
        test("creates with faces and edges", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            expect(geo).toBeInstanceOf(ThreeGeometry);
            expect(geo.visible).toBe(true);
        });

        test("creates when only edges are present", () => {
            const node = createTestGeometryNode({ hasFaces: false, hasVertexs: false });
            const geo = new ThreeGeometry(node, context);
            expect(geo.faces()).toBeUndefined();
            expect(geo.edges()).toBeInstanceOf(LineSegments2);
            expect(geo.vertexs()).toBeUndefined();
        });

        test("creates when only faces are present", () => {
            const node = createTestGeometryNode({ hasEdges: false, hasVertexs: false });
            const geo = new ThreeGeometry(node, context);
            expect(geo.faces()).toBeInstanceOf(Mesh);
            expect(geo.edges()).toBeUndefined();
            expect(geo.vertexs()).toBeUndefined();
        });

        test("creates when only vertexs are present", () => {
            const node = createTestGeometryNode({ hasFaces: false, hasEdges: false });
            const geo = new ThreeGeometry(node, context);
            expect(geo.faces()).toBeUndefined();
            expect(geo.edges()).toBeUndefined();
            expect(geo.vertexs()).toBeInstanceOf(Points);
        });

        test("solid edges use defaultEdgeMaterial", () => {
            const node = createTestGeometryNode({ edgeLineType: "solid" });
            const geo = new ThreeGeometry(node, context);
            expect(geo.edges()?.material).toBe(defaultEdgeMaterial);
        });

        test("dashed edges (e.g. a construction line) get their own material, not the shared default", () => {
            const node = createTestGeometryNode({ edgeLineType: "dash" });
            const geo = new ThreeGeometry(node, context);
            expect(geo.edges()?.material).not.toBe(defaultEdgeMaterial);
            expect((geo.edges()?.material as any).dashed).toBe(true);
        });

        test("dashed edges use the mesh data's own color (e.g. construction blue), not the shared default", () => {
            const node = createTestGeometryNode({ edgeLineType: "dash" });
            const geo = new ThreeGeometry(node, context);
            const material = geo.edges()?.material as any;
            // createTestGeometryNode's mock edges always carry color 0xff0000.
            expect(material.color.getHex()).toBe(0xff0000);
        });

        test("dashed edges have their line distances computed (required for the dash pattern to render)", () => {
            const node = createTestGeometryNode({ edgeLineType: "dash" });
            const geo = new ThreeGeometry(node, context);
            const geometry = geo.edges()?.geometry as any;
            expect(geometry.attributes.instanceDistanceStart).toBeDefined();
        });

        test("solid edges do not get line distances computed", () => {
            const node = createTestGeometryNode({ edgeLineType: "solid" });
            const geo = new ThreeGeometry(node, context);
            const geometry = geo.edges()?.geometry as any;
            expect(geometry.attributes.instanceDistanceStart).toBeUndefined();
        });
    });

    describe("faces / edges / vertexs accessors", () => {
        test("faces returns the face mesh", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            expect(geo.faces()).toBeInstanceOf(Mesh);
        });

        test("edges returns the edges mesh", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            expect(geo.edges()).toBeInstanceOf(LineSegments2);
        });

        test("vertexs returns the vertex points", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            expect(geo.vertexs()).toBeInstanceOf(Points);
        });

        test("faces returns undefined when no faces present", () => {
            const node = createTestGeometryNode({ hasFaces: false });
            const geo = new ThreeGeometry(node, context);
            expect(geo.faces()).toBeUndefined();
        });

        test("edges returns undefined when no edges present", () => {
            const node = createTestGeometryNode({ hasEdges: false });
            const geo = new ThreeGeometry(node, context);
            expect(geo.edges()).toBeUndefined();
        });
    });

    describe("boundingBox / box", () => {
        test("boundingBox returns object with min/max from faces", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const box = geo.boundingBox();
            // face positions span (0,0,0)..(1,1,0) in createTestGeometryNode
            expect(box?.min.x).toBe(0);
            expect(box?.min.y).toBe(0);
            expect(box?.min.z).toBe(0);
            expect(box?.max.x).toBe(1);
            expect(box?.max.y).toBe(1);
            expect(box?.max.z).toBe(0);
        });

        test("box returns the Three.js bounding box", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const box = geo.box();
            expect(box).toBeInstanceOf(Box3);
            expect(box?.isEmpty()).toBe(false);
        });
    });

    describe("changeFaceMaterial", () => {
        test("changeFaceMaterial updates face material", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const newMat = new MeshBasicMaterial({ color: 0xff00ff });
            geo.changeFaceMaterial(newMat);
            expect(geo.faces()?.material).toBe(newMat);
        });

        test("changeFaceMaterial is a no-op when no faces present", () => {
            const node = createTestGeometryNode({ hasFaces: false });
            const geo = new ThreeGeometry(node, context);
            geo.changeFaceMaterial(new MeshBasicMaterial());
            expect(geo.faces()).toBeUndefined();
        });
    });

    describe("set temporary materials", () => {
        test("setFacesMateiralTemperary replaces the face material", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const mat = new MeshBasicMaterial({ color: 0xaa00aa });
            geo.setFacesMateiralTemperary(mat as any);
            expect(geo.faces()?.material).toBe(mat);
        });

        test("setEdgesMateiralTemperary replaces the edge material", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const material = { isLineMaterial: true } as any;
            geo.setEdgesMateiralTemperary(material);
            expect(geo.edges()?.material).toBe(material);
        });

        test("removeTemperaryMaterial resets to defaults", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const originalFaceMat = geo.faces()?.material;

            const tempFaceMat = new MeshBasicMaterial({ color: 0xaa00aa });
            geo.setFacesMateiralTemperary(tempFaceMat as any);
            const tempEdgeMat = { isLineMaterial: true } as any;
            geo.setEdgesMateiralTemperary(tempEdgeMat);
            expect(geo.faces()?.material).toBe(tempFaceMat);
            expect(geo.edges()?.material).toBe(tempEdgeMat);

            geo.removeTemperaryMaterial();
            expect(geo.faces()?.material).toBe(originalFaceMat);
            expect(geo.edges()?.material).toBe(defaultEdgeMaterial);
        });
    });

    describe("subShapeVisual / wholeVisual", () => {
        test("wholeVisual returns array with faces, edges, vertexs", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const visuals = geo.wholeVisual();
            expect(visuals.length).toBe(3); // faces + edges + vertexs
        });

        test("wholeVisual filters out undefined parts", () => {
            const node = createTestGeometryNode({ hasVertexs: false });
            const geo = new ThreeGeometry(node, context);
            const visuals = geo.wholeVisual();
            expect(visuals.length).toBe(2); // faces + edges
        });

        test("subShapeVisual with whole shape type returns all parts", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const shapes = geo.subShapeVisual(ShapeTypes.shape);
            expect(shapes.length).toBe(3);
        });

        test("subShapeVisual with face type returns faces", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            // ShapeTypes.face = 0b10000 = 16
            const shapes = geo.subShapeVisual(ShapeTypes.face);
            expect(shapes.length).toBe(1);
        });

        test("subShapeVisual with edge type returns edges", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            // ShapeTypes.edge = 0b1000000 = 64
            const shapes = geo.subShapeVisual(ShapeTypes.edge);
            expect(shapes.length).toBe(1);
        });

        test("subShapeVisual with wire type returns edges too", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const shapes = geo.subShapeVisual(ShapeTypes.wire);
            expect(shapes.length).toBe(1);
        });
    });

    describe("getSubShapeAndIndex", () => {
        test("getSubShapeAndIndex finds face", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const result = geo.getSubShapeAndIndex("face", 0);
            expect(result.subShape?.id).toBe("f1");
            expect(result.shape).toBe(result.subShape);
            expect(result.index).toBe(0);
        });

        test("getSubShapeAndIndex finds edge", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const result = geo.getSubShapeAndIndex("edge", 0);
            expect(result.subShape?.id).toBe("e1");
            expect(result.shape).toBe(result.subShape);
            expect(result.index).toBe(0);
        });

        test("getSubShapeAndIndex finds vertex", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const result = geo.getSubShapeAndIndex("vertex", 0);
            expect(result.subShape?.id).toBe("v1");
            expect(result.shape).toBe(result.subShape);
            expect(result.index).toBe(0);
        });

        test("getSubShapeAndIndex returns empty when no edge range", () => {
            const node = createTestGeometryNode({ hasEdges: false });
            const geo = new ThreeGeometry(node, context);
            const result = geo.getSubShapeAndIndex("edge", 0);
            expect(result.shape).toBeUndefined();
        });
    });

    describe("dispose", () => {
        test("dispose removes all sub-meshes", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            expect(geo.children.length).toBe(3);

            geo.dispose();
            expect(geo.children.length).toBe(0);
        });
    });

    describe("property change handler", () => {
        test("materialId change updates face material", () => {
            const node = createTestGeometryNode();
            const geo = new ThreeGeometry(node, context);
            const originalFaceMat = geo.faces()?.material;

            node._notify("materialId");
            // The mock context returns a new material instance per getMaterial call
            expect(geo.faces()?.material).not.toBe(originalFaceMat);
        });
    });
});
