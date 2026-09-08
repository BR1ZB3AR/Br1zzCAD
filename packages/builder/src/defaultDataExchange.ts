// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    EditableShapeNode,
    I18n,
    type IDataExchange,
    type IDocument,
    type INode,
    type IShape,
    PubSub,
    Result,
    ShapeNode,
    type VisualNode,
} from "@chili3d/core";
import { buildFacetedShape } from "./meshShapeBuilder";
import { parseObj } from "./objImporter";
import { estimateStlTriangleCount } from "./stlTriangleCount";
import { parse3mf } from "./threeMfImporter";

/**
 * Above this triangle count, STL import via the native OCCT/WASM path
 * degrades sharply rather than scaling linearly: ~10k triangles imports in a
 * couple seconds, ~50k takes roughly ten, and ~100k+ can run for a minute or
 * more before either finishing or crashing the WASM runtime outright (an
 * unrecoverable "RuntimeError: null function" that requires reloading the
 * page). Reject early with a clear message instead of hanging or crashing.
 */
const MAX_STL_TRIANGLES = 50000;

export class DefaultDataExchange implements IDataExchange {
    importFormats(): string[] {
        return [".step", ".stp", ".iges", ".igs", ".brep", ".stl", ".obj", ".3mf"];
    }

    exportFormats(): string[] {
        return [".step", ".iges", ".brep", ".stl", ".stl binary", ".ply", ".ply binary", ".obj"];
    }

    async import(document: IDocument, files: FileList | File[]): Promise<void> {
        for (const file of files) {
            await this.handleSingleFileImport(document, file);
        }
    }

    private async handleSingleFileImport(document: IDocument, file: File) {
        let importResult: Result<INode> | undefined;

        const fileName = file.name.toLocaleLowerCase();
        if (this.extensionIs(fileName, ".brep")) {
            importResult = await this.importBrep(document, file);
        } else if (this.extensionIs(fileName, ".stl")) {
            importResult = await this.importStl(document, file);
        } else if (this.extensionIs(fileName, ".step", ".stp")) {
            importResult = await this.importStep(document, file);
        } else if (this.extensionIs(fileName, ".iges", ".igs")) {
            importResult = await this.importIges(document, file);
        } else if (this.extensionIs(fileName, ".obj")) {
            importResult = await this.importObj(document, file);
        } else if (this.extensionIs(fileName, ".3mf")) {
            importResult = await this.import3mf(document, file);
        }

        this.handleImportResult(document, fileName, importResult);
    }

    private extensionIs(fileName: string, ...extensions: string[]): boolean {
        return extensions.some((ext) => fileName.endsWith(ext));
    }

    private handleImportResult(document: IDocument, name: string, nodeResult: Result<INode> | undefined) {
        if (!nodeResult) {
            // Extension wasn't recognized at all - handleSingleFileImport never
            // called an importer, so there's no specific failure reason to show.
            alert(I18n.translate("error.import.unsupportedFileType:{0}", name));
            return;
        }
        if (!nodeResult.isOk) {
            // Extension was recognized, but the file itself failed to import
            // (e.g. invalid content, or too large - see importStl's triangle
            // count check) - show the actual reason instead of implying the
            // format itself isn't supported.
            alert(I18n.translate("error.default:{0}", nodeResult.error));
            return;
        }

        const node = nodeResult.value;
        node.name = name;
        document.modelManager.addNode(node);
        document.visual.update();
    }

    async importBrep(document: IDocument, file: File) {
        const shape = shapeConverter.convertFromBrep(await file.text());
        if (!shape.isOk) {
            return Result.err(shape.error);
        }
        return Result.ok(new EditableShapeNode({ document, name: file.name, shape: shape.value }));
    }

    // OCCT has no built-in reader wired into this build for OBJ or 3MF, so
    // these two parse the file themselves and build a faceted shape (see
    // meshShapeBuilder.ts) rather than going through shapeConverter.
    private async importObj(document: IDocument, file: File) {
        try {
            const shape = buildFacetedShape(parseObj(await file.text()));
            if (!shape.isOk) return Result.err(shape.error);
            return Result.ok(new EditableShapeNode({ document, name: file.name, shape: shape.value }));
        } catch (e) {
            return Result.err(e instanceof Error ? e.message : String(e));
        }
    }

    private async import3mf(document: IDocument, file: File) {
        try {
            const shape = buildFacetedShape(await parse3mf(file));
            if (!shape.isOk) return Result.err(shape.error);
            return Result.ok(new EditableShapeNode({ document, name: file.name, shape: shape.value }));
        } catch (e) {
            return Result.err(e instanceof Error ? e.message : String(e));
        }
    }

    private async importStl(document: IDocument, file: File) {
        const content = new Uint8Array(await file.arrayBuffer());
        const triangleCount = estimateStlTriangleCount(content);
        if (triangleCount !== undefined && triangleCount > MAX_STL_TRIANGLES) {
            return Result.err(
                `This STL has ~${triangleCount.toLocaleString()} triangles, which exceeds the ` +
                    `${MAX_STL_TRIANGLES.toLocaleString()} supported for import - larger meshes can take ` +
                    "minutes or crash. Try simplifying/decimating the mesh first.",
            );
        }
        return shapeConverter.convertFromSTL(document, content);
    }

    private async importIges(document: IDocument, file: File) {
        const content = new Uint8Array(await file.arrayBuffer());
        return shapeConverter.convertFromIGES(document, content);
    }

    private async importStep(document: IDocument, file: File) {
        const content = new Uint8Array(await file.arrayBuffer());
        return shapeConverter.convertFromSTEP(document, content);
    }

    async export(type: string, nodes: VisualNode[]): Promise<BlobPart[] | undefined> {
        if (nodes.length === 0) return undefined;

        const document = nodes[0].document;
        let shapeResult: Result<BlobPart> | undefined;
        if (type === ".ply") {
            shapeResult = document.visual.meshExporter.exportToPly(nodes, true);
        } else if (type === ".ply binary") {
            shapeResult = document.visual.meshExporter.exportToPly(nodes, false);
        } else if (type === ".obj") {
            shapeResult = document.visual.meshExporter.exportToObj(nodes);
        } else {
            const shapes = this.getExportShapes(nodes);
            if (!shapes.length) return undefined;
            // STL goes through the headless OCCT-mesh converter (not the Three.js
            // visual exporter), so the same path works in the browser and the MCP server.
            if (type === ".stl") shapeResult = this.exportStl(document, shapes, false);
            if (type === ".stl binary") shapeResult = this.exportStl(document, shapes, true);
            if (type === ".step") shapeResult = this.exportStep(document, shapes);
            if (type === ".iges") shapeResult = this.exportIges(document, shapes);
            if (type === ".brep") shapeResult = this.exportBrep(document, shapes);
        }

        if (shapeResult) {
            return this.handleExportResult(shapeResult);
        }
        return undefined;
    }

    private getExportShapes(nodes: VisualNode[]): IShape[] {
        const shapes = nodes
            .filter((x): x is ShapeNode => x instanceof ShapeNode)
            .map((x) => x.shape.value.transformedMul(x.worldTransform()));

        !shapes.length && PubSub.default.pub("showToast", "error.export.noNodeCanBeExported");
        return shapes;
    }

    private exportStl(doc: IDocument, shapes: IShape[], binary: boolean): Result<BlobPart> {
        return shapeConverter.convertToSTL(shapes, { binary }) as Result<BlobPart>;
    }

    private exportStep(doc: IDocument, shapes: IShape[]) {
        return shapeConverter.convertToSTEP(...shapes);
    }

    private exportIges(doc: IDocument, shapes: IShape[]) {
        return shapeConverter.convertToIGES(...shapes);
    }

    private exportBrep(document: IDocument, shapes: IShape[]) {
        const comp = shapeFactory.combine(shapes);
        if (!comp.isOk) {
            return Result.err(comp.error);
        }

        const result = shapeConverter.convertToBrep(comp.value);
        comp.value.dispose();
        return result;
    }

    private handleExportResult(result: Result<BlobPart> | undefined) {
        if (!result?.isOk) {
            PubSub.default.pub("showToast", "error.default:{0}", result?.error);
            return undefined;
        }
        return [result.value];
    }
}
