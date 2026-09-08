// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    EditableShapeNode,
    type IDocument,
    type IMeshExporter,
    type INode,
    type IShape,
    type Matrix4,
    PubSub,
    Result,
    type VisualNode,
} from "@chili3d/core";
import { createMockDocument, MockShape, TestNode } from "@chili3d/core/test-utils";
import { rs } from "@rstest/core";
import { DefaultDataExchange } from "../src/defaultDataExchange";

describe("DefaultDataExchange", () => {
    let exchange: DefaultDataExchange;

    beforeEach(() => {
        exchange = new DefaultDataExchange();
    });

    describe("importFormats", () => {
        test("should return supported import formats", () => {
            const formats = exchange.importFormats();
            expect(formats).toContain(".step");
            expect(formats).toContain(".stp");
            expect(formats).toContain(".iges");
            expect(formats).toContain(".igs");
            expect(formats).toContain(".brep");
            expect(formats).toContain(".stl");
            expect(formats).toContain(".obj");
            expect(formats).toContain(".3mf");
        });

        test("should return an array of strings", () => {
            const formats = exchange.importFormats();
            expect(Array.isArray(formats)).toBe(true);
            for (const f of formats) {
                expect(typeof f).toBe("string");
            }
        });
    });

    describe("exportFormats", () => {
        test("should return supported export formats", () => {
            const formats = exchange.exportFormats();
            expect(formats).toContain(".step");
            expect(formats).toContain(".iges");
            expect(formats).toContain(".brep");
            expect(formats).toContain(".stl");
            expect(formats).toContain(".stl binary");
            expect(formats).toContain(".ply");
            expect(formats).toContain(".ply binary");
            expect(formats).toContain(".obj");
        });

        test("should return an array of strings", () => {
            const formats = exchange.exportFormats();
            expect(Array.isArray(formats)).toBe(true);
            for (const f of formats) {
                expect(typeof f).toBe("string");
            }
        });
    });

    describe("extensionIs (private)", () => {
        // NOTE: extensionIs does NOT lowercase internally — the caller
        // (handleSingleFileImport) lowercases the fileName before passing it in.
        test("should match exact extension (already lowercased by caller)", () => {
            expect((exchange as any).extensionIs("model.step", ".step")).toBe(true);
        });

        test("should return false for non-matching extension", () => {
            expect((exchange as any).extensionIs("model.stl", ".step")).toBe(false);
        });

        test("should match against multiple extensions", () => {
            expect((exchange as any).extensionIs("model.stp", ".step", ".stp")).toBe(true);
        });

        test("should return false when none match", () => {
            expect((exchange as any).extensionIs("model.obj", ".step", ".iges")).toBe(false);
        });

        test("should match .stl extension", () => {
            expect((exchange as any).extensionIs("model.stl", ".stl")).toBe(true);
        });

        test("should match .brep extension", () => {
            expect((exchange as any).extensionIs("model.brep", ".brep")).toBe(true);
        });
    });

    describe("handleImportResult (private)", () => {
        afterEach(() => {
            rs.unstubAllGlobals();
        });

        test("should show alert when nodeResult is undefined", () => {
            const alertSpy = rs.fn();
            rs.stubGlobal("alert", alertSpy);

            (exchange as any).handleImportResult(createMockDocument(), "test.step", undefined);

            expect(alertSpy).toHaveBeenCalled();
        });

        test("should show alert when nodeResult is not ok", () => {
            const alertSpy = rs.fn();
            rs.stubGlobal("alert", alertSpy);

            (exchange as any).handleImportResult(createMockDocument(), "test.step", Result.err("some error"));

            expect(alertSpy).toHaveBeenCalled();
        });

        test("should add node and set its name on success", () => {
            const addNodeSpy = rs.fn();
            const updateSpy = rs.fn();
            const node = { name: "" } as unknown as INode;
            const doc = createMockDocument({ modelManager: { addNode: addNodeSpy } });
            doc.visual.update = updateSpy;

            (exchange as any).handleImportResult(doc, "model.step", Result.ok(node));

            expect(node.name).toBe("model.step");
            expect(addNodeSpy).toHaveBeenCalledWith(node);
            expect(updateSpy).toHaveBeenCalled();
        });
    });

    describe("handleExportResult (private)", () => {
        test("should return array with value when result is ok", () => {
            const blobPart = "blob-data";
            const result = (exchange as any).handleExportResult(Result.ok(blobPart));
            expect(result).toEqual([blobPart]);
        });

        test("should return undefined when result is undefined", () => {
            const result = (exchange as any).handleExportResult(undefined);
            expect(result).toBeUndefined();
        });

        test("should return undefined when result is err", () => {
            const result = (exchange as any).handleExportResult(Result.err("error"));
            expect(result).toBeUndefined();
        });
    });

    describe("import", () => {
        test("should handle empty file list", async () => {
            const doc = {
                modelManager: { rootNode: { add: rs.fn() }, addNode: rs.fn() },
                visual: { update: rs.fn() },
            } as unknown as IDocument;
            await expect(exchange.import(doc, [])).resolves.toBeUndefined();
        });
    });

    describe("import routing (handleSingleFileImport)", () => {
        afterEach(() => {
            rs.unstubAllGlobals();
        });

        function setup() {
            const node = { name: "" } as unknown as INode;
            const converter = {
                convertFromBrep: rs.fn((_text: string) => Result.ok(new MockShape({ id: "brep-shape" }))),
                convertFromSTL: rs.fn(
                    (_doc: IDocument, _content: Uint8Array) => Result.ok(node) as Result<INode>,
                ),
                convertFromIGES: rs.fn(
                    (_doc: IDocument, _content: Uint8Array) => Result.ok(node) as Result<INode>,
                ),
                convertFromSTEP: rs.fn(
                    (_doc: IDocument, _content: Uint8Array) => Result.ok(node) as Result<INode>,
                ),
            };
            rs.stubGlobal("shapeConverter", converter);
            const addNodeSpy = rs.fn();
            const updateSpy = rs.fn();
            const doc = createMockDocument({ modelManager: { addNode: addNodeSpy } });
            doc.visual.update = updateSpy;
            return { converter, node, doc, addNodeSpy, updateSpy };
        }

        test("should route .brep through convertFromBrep with the file text", async () => {
            const { converter, doc, addNodeSpy, updateSpy } = setup();

            await exchange.import(doc, [new File(["brep content"], "model.brep")]);

            expect(converter.convertFromBrep).toHaveBeenCalledTimes(1);
            expect(converter.convertFromBrep).toHaveBeenCalledWith("brep content");
            expect(addNodeSpy).toHaveBeenCalledTimes(1);
            const addedNode = addNodeSpy.mock.calls[0][0] as INode;
            expect(addedNode.name).toBe("model.brep");
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });

        test.each([
            { file: "model.step", method: "convertFromSTEP" },
            { file: "model.stp", method: "convertFromSTEP" },
            { file: "model.iges", method: "convertFromIGES" },
            { file: "model.igs", method: "convertFromIGES" },
            { file: "model.stl", method: "convertFromSTL" },
        ] as const)("should route $file to shapeConverter.$method", async ({ file, method }) => {
            const { converter, node, doc, addNodeSpy } = setup();

            await exchange.import(doc, [new File([new Uint8Array([1, 2, 3])], file)]);

            expect(converter[method]).toHaveBeenCalledTimes(1);
            const [docArg, contentArg] = converter[method].mock.calls[0];
            expect(docArg).toBe(doc);
            expect(contentArg).toBeInstanceOf(Uint8Array);
            expect(converter.convertFromBrep).not.toHaveBeenCalled();
            expect(addNodeSpy).toHaveBeenCalledWith(node);
            expect(node.name).toBe(file);
        });

        test("should reject an STL whose triangle count exceeds the safe import limit", async () => {
            const alertSpy = rs.fn();
            rs.stubGlobal("alert", alertSpy);
            const { converter, doc, addNodeSpy } = setup();
            // Binary STL header declaring far more triangles than the cap -
            // the buffer itself doesn't need real triangle data, since the
            // count is read straight from the header before any real parsing.
            const header = new Uint8Array(84);
            new DataView(header.buffer).setUint32(80, 1_000_000, true);
            const oversized = new Uint8Array(84 + 1_000_000 * 50);
            oversized.set(header);

            await exchange.import(doc, [new File([oversized], "huge.stl")]);

            expect(converter.convertFromSTL).not.toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).not.toHaveBeenCalled();
        });

        test("should still import an STL at or under the safe triangle limit", async () => {
            const { converter, node, doc, addNodeSpy } = setup();
            // A properly-sized binary STL declaring 100 triangles (well
            // under the cap) - the triangle bytes themselves are zeroed,
            // since only the declared count needs to be valid for this check.
            const small = new Uint8Array(84 + 100 * 50);
            new DataView(small.buffer).setUint32(80, 100, true);

            await exchange.import(doc, [new File([small], "small.stl")]);

            expect(converter.convertFromSTL).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).toHaveBeenCalledWith(node);
        });

        test("should lowercase the file name before routing", async () => {
            const { converter, node, doc, addNodeSpy } = setup();

            await exchange.import(doc, [new File([new Uint8Array([1])], "MODEL.STEP")]);

            expect(converter.convertFromSTEP).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).toHaveBeenCalledWith(node);
            expect(node.name).toBe("model.step");
        });

        test("should alert and not call any converter for an unsupported extension", async () => {
            const alertSpy = rs.fn();
            rs.stubGlobal("alert", alertSpy);
            const { converter, doc, addNodeSpy } = setup();

            await exchange.import(doc, [new File(["data"], "model.xyz")]);

            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(converter.convertFromBrep).not.toHaveBeenCalled();
            expect(converter.convertFromSTL).not.toHaveBeenCalled();
            expect(converter.convertFromIGES).not.toHaveBeenCalled();
            expect(converter.convertFromSTEP).not.toHaveBeenCalled();
            expect(addNodeSpy).not.toHaveBeenCalled();
        });

        test("should import every file in the list", async () => {
            const { converter, doc, addNodeSpy } = setup();

            await exchange.import(doc, [
                new File(["a"], "a.brep"),
                new File([new Uint8Array([1])], "b.step"),
            ]);

            expect(converter.convertFromBrep).toHaveBeenCalledTimes(1);
            expect(converter.convertFromSTEP).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).toHaveBeenCalledTimes(2);
        });
    });

    // OBJ and 3MF don't go through shapeConverter (OCCT has no reader for
    // either in this build) - they're parsed in TS and built into a faceted
    // shape via shapeFactory instead (see meshShapeBuilder.ts).
    describe("import routing - mesh formats (OBJ / 3MF)", () => {
        afterEach(() => {
            rs.unstubAllGlobals();
        });

        function stubMeshShapeFactory() {
            const triFace = { id: "tri-face", dispose: rs.fn() };
            const factory = {
                polygon: rs.fn(() => Result.ok({ id: "wire", dispose: rs.fn() })),
                face: rs.fn(() => Result.ok(triFace)),
                shell: rs.fn(() => Result.ok({ id: "shell-shape" })),
                combine: rs.fn(),
            };
            rs.stubGlobal("shapeFactory", factory);
            return factory;
        }

        test("should route .obj through parseObj + buildFacetedShape", async () => {
            const factory = stubMeshShapeFactory();
            const addNodeSpy = rs.fn();
            const doc = createMockDocument({ modelManager: { addNode: addNodeSpy } });
            doc.visual.update = rs.fn();
            const objText = ["v 0 0 0", "v 1 0 0", "v 0 1 0", "f 1 2 3"].join("\n");

            await exchange.import(doc, [new File([objText], "model.obj")]);

            expect(factory.polygon).toHaveBeenCalledTimes(1);
            expect(factory.shell).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).toHaveBeenCalledTimes(1);
            const addedNode = addNodeSpy.mock.calls[0][0] as INode;
            expect(addedNode.name).toBe("model.obj");
        });

        test("should route .3mf through parse3mf + buildFacetedShape", async () => {
            const factory = stubMeshShapeFactory();
            const addNodeSpy = rs.fn();
            const doc = createMockDocument({ modelManager: { addNode: addNodeSpy } });
            doc.visual.update = rs.fn();
            const { default: JSZip } = await import("jszip");
            const zip = new JSZip();
            zip.file(
                "3D/3dmodel.model",
                `<?xml version="1.0"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" />
          <vertex x="1" y="0" z="0" />
          <vertex x="0" y="1" z="0" />
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2" /></triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1" /></build>
</model>`,
            );
            const blob = await zip.generateAsync({ type: "blob" });
            const file = new File([blob], "model.3mf");

            await exchange.import(doc, [file]);

            expect(factory.polygon).toHaveBeenCalledTimes(1);
            expect(factory.shell).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).toHaveBeenCalledTimes(1);
            const addedNode = addNodeSpy.mock.calls[0][0] as INode;
            expect(addedNode.name).toBe("model.3mf");
        });

        test("should alert (not throw) when the OBJ mesh has no faces", async () => {
            stubMeshShapeFactory();
            const alertSpy = rs.fn();
            rs.stubGlobal("alert", alertSpy);
            const addNodeSpy = rs.fn();
            const doc = createMockDocument({ modelManager: { addNode: addNodeSpy } });

            await exchange.import(doc, [new File(["v 0 0 0"], "empty.obj")]);

            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).not.toHaveBeenCalled();
        });

        test("should alert (not throw) for a 3MF package missing 3D/3dmodel.model", async () => {
            stubMeshShapeFactory();
            const alertSpy = rs.fn();
            rs.stubGlobal("alert", alertSpy);
            const addNodeSpy = rs.fn();
            const doc = createMockDocument({ modelManager: { addNode: addNodeSpy } });
            const { default: JSZip } = await import("jszip");
            const zip = new JSZip();
            zip.file("readme.txt", "not a model");
            const blob = await zip.generateAsync({ type: "blob" });

            await exchange.import(doc, [new File([blob], "bad.3mf")]);

            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(addNodeSpy).not.toHaveBeenCalled();
        });
    });

    describe("export", () => {
        let pubSpy: ReturnType<typeof rs.spyOn>;

        beforeEach(() => {
            pubSpy = rs.spyOn(PubSub.default, "pub").mockImplementation(() => {});
        });

        afterEach(() => {
            pubSpy.mockRestore();
            rs.unstubAllGlobals();
        });

        function createShapeNode(doc: IDocument, name: string) {
            const shape = new MockShape({ id: `${name}-shape` });
            const transformed = new MockShape({ id: `${name}-transformed` });
            const transformedMul = rs.fn((_matrix: Matrix4) => transformed);
            shape.transformedMul = transformedMul;
            const node = new EditableShapeNode({ document: doc, name, shape: Result.ok(shape) });
            return { node, shape, transformed, transformedMul };
        }

        function createDocWithMeshExporter() {
            const doc = createMockDocument();
            const exportToPly = rs.fn(
                (_nodes: VisualNode[], _asciiMode: boolean) => Result.ok("ply-data") as Result<BlobPart>,
            );
            const exportToObj = rs.fn((_nodes: VisualNode[]) => Result.ok("obj-data") as Result<BlobPart>);
            Object.assign(doc.visual, {
                meshExporter: { exportToPly, exportToObj } as unknown as IMeshExporter,
            });
            return { doc, exportToPly, exportToObj };
        }

        function stubShapeConverter() {
            const converter = {
                convertToSTL: rs.fn(
                    (_shapes: IShape[], _options?: { binary: boolean }) =>
                        Result.ok(new Uint8Array([1, 2, 3])) as Result<BlobPart>,
                ),
                convertToSTEP: rs.fn((..._shapes: IShape[]) => Result.ok("step-data") as Result<BlobPart>),
                convertToIGES: rs.fn((..._shapes: IShape[]) => Result.ok("iges-data") as Result<BlobPart>),
                convertToBrep: rs.fn((_shape: IShape) => Result.ok("brep-data") as Result<BlobPart>),
            };
            rs.stubGlobal("shapeConverter", converter);
            return converter;
        }

        test("should return undefined for empty nodes array", async () => {
            const result = await exchange.export(".step", []);
            expect(result).toBeUndefined();
        });

        test("should route .ply to meshExporter.exportToPly with asciiMode=true", async () => {
            const { doc, exportToPly, exportToObj } = createDocWithMeshExporter();
            const { node } = createShapeNode(doc, "ply-node");

            const result = await exchange.export(".ply", [node]);

            expect(result).toEqual(["ply-data"]);
            expect(exportToPly).toHaveBeenCalledTimes(1);
            expect(exportToPly).toHaveBeenCalledWith([node], true);
            expect(exportToObj).not.toHaveBeenCalled();
        });

        test("should route .ply binary to meshExporter.exportToPly with asciiMode=false", async () => {
            const { doc, exportToPly, exportToObj } = createDocWithMeshExporter();
            const { node } = createShapeNode(doc, "ply-bin-node");

            const result = await exchange.export(".ply binary", [node]);

            expect(result).toEqual(["ply-data"]);
            expect(exportToPly).toHaveBeenCalledTimes(1);
            expect(exportToPly).toHaveBeenCalledWith([node], false);
            expect(exportToObj).not.toHaveBeenCalled();
        });

        test("should route .obj to meshExporter.exportToObj", async () => {
            const { doc, exportToPly, exportToObj } = createDocWithMeshExporter();
            const { node } = createShapeNode(doc, "obj-node");

            const result = await exchange.export(".obj", [node]);

            expect(result).toEqual(["obj-data"]);
            expect(exportToObj).toHaveBeenCalledTimes(1);
            expect(exportToObj).toHaveBeenCalledWith([node]);
            expect(exportToPly).not.toHaveBeenCalled();
        });

        test.each([
            { type: ".stl", binary: false },
            { type: ".stl binary", binary: true },
        ])("should route $type to shapeConverter.convertToSTL with binary=$binary", async ({
            type,
            binary,
        }) => {
            const converter = stubShapeConverter();
            const doc = createMockDocument();
            const { node, transformed, transformedMul } = createShapeNode(doc, "stl-node");

            const result = await exchange.export(type, [node]);

            expect(result).toEqual([new Uint8Array([1, 2, 3])]);
            expect(transformedMul).toHaveBeenCalledTimes(1);
            expect(converter.convertToSTL).toHaveBeenCalledTimes(1);
            expect(converter.convertToSTL).toHaveBeenCalledWith([transformed], { binary });
            expect(converter.convertToSTEP).not.toHaveBeenCalled();
            expect(converter.convertToIGES).not.toHaveBeenCalled();
            expect(converter.convertToBrep).not.toHaveBeenCalled();
        });

        test.each([
            { type: ".step", method: "convertToSTEP", data: "step-data" },
            { type: ".iges", method: "convertToIGES", data: "iges-data" },
        ] as const)("should route $type to shapeConverter.$method with the transformed shape", async ({
            type,
            method,
            data,
        }) => {
            const converter = stubShapeConverter();
            const doc = createMockDocument();
            const { node, transformed, transformedMul } = createShapeNode(doc, "cad-node");

            const result = await exchange.export(type, [node]);

            expect(result).toEqual([data]);
            expect(transformedMul).toHaveBeenCalledTimes(1);
            expect(converter[method]).toHaveBeenCalledTimes(1);
            expect(converter[method]).toHaveBeenCalledWith(transformed);
            expect(converter.convertToSTL).not.toHaveBeenCalled();
        });

        test("should route .brep through shapeFactory.combine then convertToBrep and dispose the compound", async () => {
            const converter = stubShapeConverter();
            const combined = new MockShape({ id: "combined" });
            const disposeSpy = rs.spyOn(combined, "dispose");
            const combine = rs.fn((_shapes: IShape[]) => Result.ok(combined));
            rs.stubGlobal("shapeFactory", { combine });
            const doc = createMockDocument();
            const { node, transformed } = createShapeNode(doc, "brep-node");

            const result = await exchange.export(".brep", [node]);

            expect(result).toEqual(["brep-data"]);
            expect(combine).toHaveBeenCalledTimes(1);
            expect(combine).toHaveBeenCalledWith([transformed]);
            expect(converter.convertToBrep).toHaveBeenCalledTimes(1);
            expect(converter.convertToBrep).toHaveBeenCalledWith(combined);
            expect(disposeSpy).toHaveBeenCalledTimes(1);
        });

        test("should return undefined and not call any exporter for an unknown type", async () => {
            const converter = stubShapeConverter();
            const doc = createMockDocument();
            const exportToPly = rs.fn();
            const exportToObj = rs.fn();
            Object.assign(doc.visual, {
                meshExporter: { exportToPly, exportToObj } as unknown as IMeshExporter,
            });
            const { node } = createShapeNode(doc, "unknown-node");

            const result = await exchange.export(".xyz", [node]);

            expect(result).toBeUndefined();
            expect(converter.convertToSTL).not.toHaveBeenCalled();
            expect(converter.convertToSTEP).not.toHaveBeenCalled();
            expect(converter.convertToIGES).not.toHaveBeenCalled();
            expect(converter.convertToBrep).not.toHaveBeenCalled();
            expect(exportToPly).not.toHaveBeenCalled();
            expect(exportToObj).not.toHaveBeenCalled();
        });

        test("should publish a toast and return undefined when no node is a ShapeNode", async () => {
            const converter = stubShapeConverter();
            const plainNode = new TestNode("plain-visual-node");

            const result = await exchange.export(".step", [plainNode]);

            expect(result).toBeUndefined();
            expect(pubSpy).toHaveBeenCalledWith("showToast", "error.export.noNodeCanBeExported");
            expect(converter.convertToSTEP).not.toHaveBeenCalled();
        });

        test("should filter out non-ShapeNode nodes and export only shape nodes", async () => {
            const converter = stubShapeConverter();
            const doc = createMockDocument();
            const plainNode = new TestNode("plain-visual-node");
            const { node, transformed } = createShapeNode(doc, "real-shape-node");

            const result = await exchange.export(".step", [plainNode, node]);

            expect(result).toEqual(["step-data"]);
            expect(converter.convertToSTEP).toHaveBeenCalledTimes(1);
            expect(converter.convertToSTEP).toHaveBeenCalledWith(transformed);
            expect(pubSpy).not.toHaveBeenCalledWith("showToast", "error.export.noNodeCanBeExported");
        });
    });
});
