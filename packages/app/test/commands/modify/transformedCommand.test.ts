// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    BoundingBox,
    ComponentNode,
    DimensionAnnotation,
    GeometryNode,
    Matrix4,
    MeshNode,
    MultistepCommand,
    Plane,
    PubSub,
    setDimensionMeasuredNodes,
    VisualConfig,
    XYZ,
} from "@chili3d/core";
import { TestDocument } from "@chili3d/core/test-utils";
import { afterAll, beforeAll, describe, expect, rs, test } from "@rstest/core";
import { LineNode } from "../../../src/bodys";
import { Move } from "../../../src/commands/modify/move";
import {
    ensureGlobalStubApp,
    makeParent,
    mockVisualNode,
    pointStepResult,
    seedStepDatas,
    stubTransactionRun,
    wireCommand,
} from "../commandTestUtils";

/** Wires a command to a real TestDocument (not the lightweight `wireCommand`
 * mock) - needed for the auto-follow tests, which sweep the real node tree
 * via `NodeUtils.findNodes(document.modelManager.rootNode, ...)`; the mock
 * document's rootNode doesn't maintain real firstChild/nextSibling links. */
function wireCommandToRealDocument<C>(cmd: C, doc: TestDocument) {
    (cmd as any)._application = {
        activeView: {
            document: doc,
            workplane: Plane.XY,
            direction: () => XYZ.unitNZ,
            htmlText: rs.fn(),
        },
    };
}

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

/**
 * The base class uses `instanceof MeshNode/GeometryNode/ComponentNode` to pick
 * a branch inside `canExcute`. `mockVisualNode` returns plain objects, so we
 * reassign the prototype so the instanceof checks resolve to the intended class
 * without constructing a real node (which would need a full document).
 */
function asInstance<T>(node: unknown, klass: abstract new (...args: any[]) => T): T {
    Object.setPrototypeOf(node, klass.prototype);
    return node as T;
}

describe("TransformedCommand (via Move)", () => {
    test("isClone should default to false", () => {
        const cmd = new Move();
        expect(cmd.isClone).toBe(false);
    });

    test("isClone setter should update property", () => {
        const cmd = new Move();
        cmd.isClone = true;
        expect(cmd.isClone).toBe(true);
    });

    test("should extend MultistepCommand", () => {
        const cmd = new Move();
        expect(cmd instanceof MultistepCommand).toBe(true);
    });

    describe("transformPreview", () => {
        test("should apply transfrom() to the seeded positions and return an EdgeMeshData", () => {
            const cmd = new Move();
            wireCommand(cmd);
            seedStepDatas(cmd, [pointStepResult({ point: XYZ.zero })]);
            // seed positions the base class reads in transformPreview
            (cmd as any).positions = [0, 0, 0, 1, 1, 1];

            const data = (cmd as any).transformPreview(new XYZ({ x: 2, y: 3, z: 4 }));

            // Move.transfrom is a pure translation by (point - stepDatas[0].point)
            // so each seeded vertex shifts by (2, 3, 4).
            expect(data.position instanceof Float32Array).toBe(true);
            expect(Array.from(data.position)).toEqual([
                2,
                3,
                4, // (0,0,0) + (2,3,4)
                3,
                4,
                5, // (1,1,1) + (2,3,4)
            ]);
            expect(data.lineType).toBe("solid");
            expect(data.color).toBe(VisualConfig.defaultEdgeColor);
        });

        test("should produce an identity-transformed preview when the translation is zero", () => {
            const cmd = new Move();
            wireCommand(cmd);
            seedStepDatas(cmd, [pointStepResult({ point: new XYZ({ x: 1, y: 1, z: 1 }) })]);
            (cmd as any).positions = [1, 2, 3];

            const data = (cmd as any).transformPreview(new XYZ({ x: 1, y: 1, z: 1 }));
            expect(Array.from(data.position)).toEqual([1, 2, 3]);
        });
    });

    describe("getTempLineData", () => {
        test("should build an edge mesh between two points with the temporary edge color", () => {
            const cmd = new Move();
            wireCommand(cmd);

            const start = new XYZ({ x: 0, y: 0, z: 0 });
            const end = new XYZ({ x: 5, y: 0, z: 0 });
            const data = (cmd as any).getTempLineData(start, end);

            expect(Array.from(data.position)).toEqual([0, 0, 0, 5, 0, 0]);
            expect(data.color).toBe(VisualConfig.temporaryEdgeColor);
            expect(data.lineType).toBe("solid");
        });
    });

    describe("ensureSelectedModels", () => {
        test("should skip the picker when selection already returns nodes", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            const { node } = mockVisualNode("mesh", { position: [0, 0, 0] });
            (doc.selection as any).getSelectedVisualNodes = () => [node];
            const pickNodeSpy = rs.spyOn(doc.picker as any, "pickNode");

            const ok = await (cmd as any).ensureSelectedModels();

            expect(ok).toBe(true);
            expect((cmd as any).models).toEqual([node]);
            expect(pickNodeSpy).not.toHaveBeenCalled();
        });

        test("should fall back to pickNode and return true when it yields models", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            const { node } = mockVisualNode("mesh", { position: [0, 0, 0] });
            (doc.selection as any).getSelectedVisualNodes = () => [];
            const pickNodeSpy = rs.spyOn(doc.picker as any, "pickNode");
            pickNodeSpy.mockResolvedValue([node]);

            const ok = await (cmd as any).ensureSelectedModels();

            expect(ok).toBe(true);
            expect((cmd as any).models).toEqual([node]);
            expect(pickNodeSpy).toHaveBeenCalled();
        });

        test("should publish toast.select.noSelected when picker succeeds but returns nothing", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            (doc.selection as any).getSelectedVisualNodes = () => [];
            // pickNode receives the AsyncController created inside ensureSelectedModels;
            // mark it success before resolving so the toast branch fires.
            (doc.picker as any).pickNode = rs.fn(async (_p: string, controller: any) => {
                controller.success();
                return [];
            });
            const pubSpy = rs.spyOn(PubSub.default, "pub");
            try {
                const ok = await (cmd as any).ensureSelectedModels();

                expect(ok).toBe(false);
                expect(pubSpy).toHaveBeenCalledWith("showToast", "toast.select.noSelected");
            } finally {
                pubSpy.mockRestore();
            }
        });

        test("should return false without toast when picker resolves empty but controller is not success", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            (doc.selection as any).getSelectedVisualNodes = () => [];
            (doc.picker as any).pickNode = rs.fn(async () => []);
            const pubSpy = rs.spyOn(PubSub.default, "pub");
            try {
                const ok = await (cmd as any).ensureSelectedModels();

                expect(ok).toBe(false);
                expect(pubSpy).not.toHaveBeenCalled();
            } finally {
                pubSpy.mockRestore();
            }
        });
    });

    describe("canExcute", () => {
        test("should flatten MeshNode mesh.position through the node transform", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            const { node } = mockVisualNode("mesh", { position: [1, 2, 3, 4, 5, 6] });
            asInstance(node, MeshNode);
            (doc.selection as any).getSelectedVisualNodes = () => [node];

            const ok = await (cmd as any).canExcute();

            expect(ok).toBe(true);
            // identity transform → positions pass through unchanged
            expect((cmd as any).positions).toEqual([1, 2, 3, 4, 5, 6]);
        });

        test("should skip a MeshNode whose mesh.position is falsy", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            const { node } = mockVisualNode("mesh", {});
            asInstance(node, MeshNode);
            (node as any).mesh = {}; // no position
            (doc.selection as any).getSelectedVisualNodes = () => [node];

            const ok = await (cmd as any).canExcute();

            expect(ok).toBe(true);
            expect((cmd as any).positions).toEqual([]);
        });

        test("should flatten GeometryNode mesh.edges.position through the node transform", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            const { node } = mockVisualNode("geometry", { edgesPosition: [7, 8, 9] });
            asInstance(node, GeometryNode);
            (doc.selection as any).getSelectedVisualNodes = () => [node];

            const ok = await (cmd as any).canExcute();

            expect(ok).toBe(true);
            expect((cmd as any).positions).toEqual([7, 8, 9]);
        });

        test("should skip a GeometryNode whose mesh.edges.position is falsy", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            const { node } = mockVisualNode("geometry", {});
            asInstance(node, GeometryNode);
            (node as any).mesh = { edges: {} };
            (doc.selection as any).getSelectedVisualNodes = () => [node];

            const ok = await (cmd as any).canExcute();

            expect(ok).toBe(true);
            expect((cmd as any).positions).toEqual([]);
        });

        test("should flatten a ComponentNode via BoundingBox.wireframe", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            const { node } = mockVisualNode("component", {});
            asInstance(node, ComponentNode);
            // canExcute reads model.boundingBox() then BoundingBox.wireframe(box);
            // return a real BoundingBox so wireframe can read min/max.
            (node as any).boundingBox = () =>
                new BoundingBox(new XYZ({ x: 0, y: 0, z: 0 }), new XYZ({ x: 1, y: 1, z: 1 }));
            (doc.selection as any).getSelectedVisualNodes = () => [node];

            const ok = await (cmd as any).canExcute();

            expect(ok).toBe(true);
            // BoundingBox.wireframe emits 12 edges × 2 endpoints × 3 coords = 72 numbers.
            const positions = (cmd as any).positions as number[];
            expect(positions.length).toBe(72);
        });

        test("should return false when no models can be resolved", async () => {
            const cmd = new Move();
            const { doc } = wireCommand(cmd);
            (doc.selection as any).getSelectedVisualNodes = () => [];
            (doc.picker as any).pickNode = rs.fn(async () => []);

            const ok = await (cmd as any).canExcute();

            expect(ok).toBe(false);
            expect((cmd as any).positions).toBeUndefined();
        });
    });

    describe("executeMainTask", () => {
        /**
         * A node that records the last transform assigned to it, so tests can
         * assert what the base class wrote without depending on Matrix4 internals.
         * `multiply` on the identity transform yields the assigned matrix directly.
         */
        function trackingNode(parent?: any) {
            const cloneHolder: any = { transform: undefined as unknown as Matrix4 };
            return {
                node: {
                    parent,
                    get transform() {
                        return Matrix4.identity();
                    },
                    set transform(value: Matrix4) {
                        (this as any)._assigned = value;
                    },
                    assigned(): Matrix4 {
                        return (this as any)._assigned;
                    },
                    worldTransform() {
                        return Matrix4.identity();
                    },
                    clone() {
                        return cloneHolder;
                    },
                },
                cloneHolder,
            };
        }

        test("should multiply each model's transform in place when isClone is false", () => {
            const restore = stubTransactionRun();
            try {
                const cmd = new Move();
                const { node } = trackingNode();
                wireCommand(cmd);
                (cmd as any).models = [node];
                seedStepDatas(cmd, [
                    pointStepResult({ point: XYZ.zero }),
                    pointStepResult({ point: new XYZ({ x: 10, y: 20, z: 30 }) }),
                ]);

                (cmd as any).executeMainTask();

                // identity.multiply(translation) == translation; move by (10,20,30).
                const expected = Matrix4.fromTranslation(10, 20, 30);
                const assigned = node.assigned();
                for (let i = 0; i < 16; i++) {
                    expect(assigned.array[i]).toBeCloseTo(expected.array[i], 6);
                }
            } finally {
                restore();
            }
        });

        test("should clone each model and insertAfter the original when isClone is true", () => {
            const restore = stubTransactionRun();
            try {
                const cmd = new Move();
                cmd.isClone = true;
                const parent = makeParent({ id: "parent" });
                const { node, cloneHolder } = trackingNode(parent);
                wireCommand(cmd);
                (cmd as any).models = [node];
                seedStepDatas(cmd, [
                    pointStepResult({ point: XYZ.zero }),
                    pointStepResult({ point: new XYZ({ x: 1, y: 2, z: 3 }) }),
                ]);

                (cmd as any).executeMainTask();

                expect(parent.insertedAfter).toHaveLength(1);
                expect(parent.insertedAfter[0].target).toBe(node);
                expect(parent.insertedAfter[0].node).toBe(cloneHolder);
                // the clone received the multiplied transform (identity * translation)
                const expected = Matrix4.fromTranslation(1, 2, 3);
                for (let i = 0; i < 16; i++) {
                    expect(cloneHolder.transform.array[i]).toBeCloseTo(expected.array[i], 6);
                }
            } finally {
                restore();
            }
        });

        test("should call document.visual.update() after mutating models", () => {
            const restore = stubTransactionRun();
            try {
                const cmd = new Move();
                const { node } = trackingNode();
                const { doc } = wireCommand(cmd);
                (cmd as any).models = [node];
                seedStepDatas(cmd, [
                    pointStepResult({ point: XYZ.zero }),
                    pointStepResult({ point: new XYZ({ x: 0, y: 0, z: 0 }) }),
                ]);
                const updateSpy = doc.visual.update as unknown as ReturnType<typeof rs.fn>;

                (cmd as any).executeMainTask();

                expect(updateSpy).toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        describe("DimensionAnnotation", () => {
            // DimensionAnnotation renders straight from its own absolute
            // startPoint/endPoint/placement, not a `.transform` matrix, so
            // Move has to carry those points through the translation itself
            // - reproduced here because a plain trackingNode mock (which
            // only has `.transform`) wouldn't catch a regression back to
            // the old `x.transform = ...` path silently no-op'ing on it.
            function makeAnnotation(doc: any, point2?: XYZ) {
                return new DimensionAnnotation({
                    document: doc,
                    annotationType: "dimension",
                    name: "Dimension",
                    dimensionType: point2 ? "angle" : "linear",
                    startPoint: new XYZ({ x: 0, y: 0, z: 0 }),
                    endPoint: new XYZ({ x: 10, y: 0, z: 0 }),
                    point2,
                    placement: new XYZ({ x: 5, y: 5, z: 0 }),
                });
            }

            test("should translate startPoint/endPoint/placement instead of touching .transform", () => {
                const restore = stubTransactionRun();
                try {
                    const cmd = new Move();
                    const { doc } = wireCommand(cmd);
                    const annotation = makeAnnotation(doc);
                    (cmd as any).models = [annotation];
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 10, y: 20, z: 30 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    expect(annotation.startPoint.isEqualTo(new XYZ({ x: 10, y: 20, z: 30 }), 1e-6)).toBe(
                        true,
                    );
                    expect(annotation.endPoint.isEqualTo(new XYZ({ x: 20, y: 20, z: 30 }), 1e-6)).toBe(true);
                    expect(annotation.placement.isEqualTo(new XYZ({ x: 15, y: 25, z: 30 }), 1e-6)).toBe(true);
                } finally {
                    restore();
                }
            });

            test("should translate point2 too when it's set (angle dimensions)", () => {
                const restore = stubTransactionRun();
                try {
                    const cmd = new Move();
                    const { doc } = wireCommand(cmd);
                    const annotation = makeAnnotation(doc, new XYZ({ x: 0, y: 10, z: 0 }));
                    (cmd as any).models = [annotation];
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 1, y: 1, z: 1 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    expect(annotation.point2!.isEqualTo(new XYZ({ x: 1, y: 11, z: 1 }), 1e-6)).toBe(true);
                } finally {
                    restore();
                }
            });

            test("should clone the annotation with translated points and leave the original untouched when isClone is true", () => {
                const restore = stubTransactionRun();
                try {
                    const cmd = new Move();
                    cmd.isClone = true;
                    const { doc } = wireCommand(cmd);
                    const annotation = makeAnnotation(doc);
                    const parent = makeParent({ id: "parent" });
                    (annotation as any).parent = parent;
                    (cmd as any).models = [annotation];
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 1, y: 0, z: 0 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    expect(annotation.startPoint).toEqual(new XYZ({ x: 0, y: 0, z: 0 }));
                    expect(parent.insertedAfter).toHaveLength(1);
                    expect(parent.insertedAfter[0].target).toBe(annotation);
                    const clone = parent.insertedAfter[0].node as DimensionAnnotation;
                    expect(clone.startPoint.isEqualTo(new XYZ({ x: 1, y: 0, z: 0 }), 1e-6)).toBe(true);
                } finally {
                    restore();
                }
            });

            test("should handle a mixed selection of a DimensionAnnotation and a regular node together", () => {
                const restore = stubTransactionRun();
                try {
                    const cmd = new Move();
                    const { doc } = wireCommand(cmd);
                    const annotation = makeAnnotation(doc);
                    const { node } = trackingNode();
                    (cmd as any).models = [annotation, node];
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 2, y: 0, z: 0 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    expect(annotation.startPoint.isEqualTo(new XYZ({ x: 2, y: 0, z: 0 }), 1e-6)).toBe(true);
                    const expected = Matrix4.fromTranslation(2, 0, 0);
                    const assigned = node.assigned();
                    for (let i = 0; i < 16; i++) {
                        expect(assigned.array[i]).toBeCloseTo(expected.array[i], 6);
                    }
                } finally {
                    restore();
                }
            });
        });

        describe("auto-follow (unselected dimensions measuring a moved shape)", () => {
            function setupLineAndDimension(doc: TestDocument) {
                const start = new XYZ({ x: 0, y: 0, z: 0 });
                const end = new XYZ({ x: 10, y: 0, z: 0 });
                const line = new LineNode({ document: doc, start, end });
                doc.modelManager.addNode(line);

                const annotation = new DimensionAnnotation({
                    document: doc,
                    annotationType: "dimension",
                    name: "Dimension",
                    dimensionType: "linear",
                    startPoint: start,
                    endPoint: end,
                    placement: new XYZ({ x: 5, y: 5, z: 0 }),
                });
                doc.modelManager.addNode(annotation);
                setDimensionMeasuredNodes(annotation, [line]);

                return { line, annotation };
            }

            test("should move a dimension that measures a selected shape, even when the dimension itself isn't selected", () => {
                const restore = stubTransactionRun();
                try {
                    const doc = new TestDocument();
                    const cmd = new Move();
                    wireCommandToRealDocument(cmd, doc);
                    const { line, annotation } = setupLineAndDimension(doc);
                    (cmd as any).models = [line]; // dimension deliberately NOT included
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 0, y: 10, z: 0 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    expect(annotation.startPoint.isEqualTo(new XYZ({ x: 0, y: 10, z: 0 }), 1e-6)).toBe(true);
                    expect(annotation.endPoint.isEqualTo(new XYZ({ x: 10, y: 10, z: 0 }), 1e-6)).toBe(true);
                } finally {
                    restore();
                }
            });

            test("should not move a dimension whose measured shape wasn't part of the move", () => {
                const restore = stubTransactionRun();
                try {
                    const doc = new TestDocument();
                    const cmd = new Move();
                    wireCommandToRealDocument(cmd, doc);
                    const { annotation } = setupLineAndDimension(doc);
                    const { node: unrelated } = trackingNode();
                    (cmd as any).models = [unrelated]; // moving something else entirely
                    const originalStart = annotation.startPoint;
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 0, y: 10, z: 0 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    expect(annotation.startPoint).toEqual(originalStart);
                } finally {
                    restore();
                }
            });

            test("should not double-move a dimension that's both explicitly selected and auto-followed", () => {
                const restore = stubTransactionRun();
                try {
                    const doc = new TestDocument();
                    const cmd = new Move();
                    wireCommandToRealDocument(cmd, doc);
                    const { line, annotation } = setupLineAndDimension(doc);
                    (cmd as any).models = [line, annotation]; // explicitly selected too
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 0, y: 10, z: 0 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    // A single translation, not two applied back-to-back.
                    expect(annotation.startPoint.isEqualTo(new XYZ({ x: 0, y: 10, z: 0 }), 1e-6)).toBe(true);
                } finally {
                    restore();
                }
            });

            test("should not auto-follow (or clone) an unselected dimension when isClone is true", () => {
                const restore = stubTransactionRun();
                try {
                    const doc = new TestDocument();
                    const cmd = new Move();
                    cmd.isClone = true;
                    wireCommandToRealDocument(cmd, doc);
                    const { line, annotation } = setupLineAndDimension(doc);
                    (cmd as any).models = [line];
                    seedStepDatas(cmd, [
                        pointStepResult({ point: XYZ.zero }),
                        pointStepResult({ point: new XYZ({ x: 0, y: 10, z: 0 }) }),
                    ]);

                    (cmd as any).executeMainTask();

                    // The original dimension is untouched, and no clone of it
                    // was created - only the explicitly-selected line was cloned.
                    expect(annotation.startPoint.isEqualTo(new XYZ({ x: 0, y: 0, z: 0 }), 1e-6)).toBe(true);
                    expect(countDimensionAnnotations(doc)).toBe(1);
                } finally {
                    restore();
                }
            });
        });
    });
});

function countDimensionAnnotations(doc: TestDocument): number {
    let count = 0;
    let node = (doc.modelManager.rootNode as any).firstChild;
    while (node) {
        if (node instanceof DimensionAnnotation) count++;
        node = node.nextSibling;
    }
    return count;
}
