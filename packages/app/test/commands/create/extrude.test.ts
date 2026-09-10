// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    EditableShapeNode,
    type IEdge,
    type IShape,
    type IWire,
    PubSub,
    Result,
    ShapeTypes,
    XYZ,
} from "@chili3d/core";
import { afterAll, beforeAll, describe, expect, rs, test } from "@rstest/core";
import { ExtrudeNode } from "../../../src/bodys/extrude";
import { ExtrudeCommand } from "../../../src/commands/create/extrude";
import { createMockShape, createMockWire } from "../../bodys/_utils";
import {
    ensureGlobalStubApp,
    pointStepResult,
    seedStepDatas,
    shapeData,
    shapeStepResult,
    wireCommand,
} from "../commandTestUtils";

/** A minimal edge shape: real enough curve for FaceNode's endpoint-based grouping. */
function mockEdgeShape(x1: number, y1: number, x2: number, y2: number): Partial<IShape> {
    return {
        shapeType: ShapeTypes.edge,
        curve: {
            firstParameter: () => 0,
            lastParameter: () => 1,
            value: (t: number) => new XYZ({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, z: 0 }),
        },
    } as unknown as Partial<IShape>;
}

/**
 * ensureGlobalStubApp() (used file-wide below) installs `globalThis.app` as a
 * Proxy whose `get` trap returns `() => Result.ok(fakeShape)` for every
 * property access, ignoring whatever the target actually holds - so
 * setupShapeFactoryMock's merge-onto-existing-factory fallback (from
 * bodys/_utils, meant for tests that don't already stub `app`) has no visible
 * effect here. Redefine `globalThis.app` directly with a plain (non-proxy)
 * factory for the scope of a single test instead.
 */
function stubShapeFactory(methods: Record<string, (...args: any[]) => any>): () => void {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "app");
    const stubApp = { shapeProvider: { factory: methods, converter: {} } } as any;
    Object.defineProperty(globalThis, "app", {
        configurable: true,
        get: () => stubApp,
    });
    return () => {
        if (previous) Object.defineProperty(globalThis, "app", previous);
    };
}

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

describe("ExtrudeCommand", () => {
    test("should have command metadata", () => {
        const data = (ExtrudeCommand as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("create.extrude");
        expect(data.icon).toBe("icon-prism");
    });

    test("getSteps should return two steps", () => {
        const cmd = new ExtrudeCommand();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    describe("geometryNode", () => {
        test("should build an ExtrudeNode whose length is the signed projection of the picked point", () => {
            // Face on the XY plane: normal() returns [point, +Z].
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([
                    {
                        shape: {
                            shapeType: ShapeTypes.face,
                            normal: () => [XYZ.zero, XYZ.unitZ],
                        } as Partial<IShape>,
                        point: XYZ.zero,
                    },
                ]),
                pointStepResult({ point: new XYZ({ x: 0, y: 0, z: 5 }) }),
            ]);

            const node = (cmd as any).geometryNode();
            expect(node).toBeInstanceOf(ExtrudeNode);
            expect(node.length).toBeCloseTo(5, 6);
        });

        test("should produce a negative length when the picked point is below the section plane", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            seedStepDatas(cmd, [
                shapeStepResult([
                    {
                        shape: {
                            shapeType: ShapeTypes.face,
                            normal: () => [XYZ.zero, XYZ.unitZ],
                            isClosed: () => false,
                        } as Partial<IShape>,
                        point: XYZ.zero,
                    },
                ]),
                pointStepResult({ point: new XYZ({ x: 0, y: 0, z: -3 }) }),
            ]);

            const node = (cmd as any).geometryNode();
            expect(node.length).toBeCloseTo(-3, 6);
        });
    });

    describe("getLengthStepData", () => {
        function buildFaceCommand(planar: boolean, surface?: () => unknown) {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            const shapeOverride: any = {
                shapeType: ShapeTypes.face,
                normal: () => [XYZ.zero, XYZ.unitZ],
            };
            if (surface) {
                shapeOverride.surface = surface;
            }
            seedStepDatas(cmd, [shapeStepResult([{ shape: shapeOverride, point: XYZ.zero }])]);
            return cmd;
        }

        test("should expose a point and a direction equal to the face normal", () => {
            const cmd = buildFaceCommand(true);
            const data = (cmd as any).getLengthStepData();
            expect(data.point.isEqualTo(XYZ.zero)).toBe(true);
            expect(data.direction.isEqualTo(XYZ.unitZ)).toBe(true);
            expect(typeof data.preview).toBe("function");
        });

        test("preview should return [] when point is undefined", () => {
            const cmd = buildFaceCommand(true);
            const data = (cmd as any).getLengthStepData();
            expect(data.preview(undefined)).toEqual([]);
        });

        test("preview should return [] when the distance is below float precision", () => {
            const cmd = buildFaceCommand(true);
            const data = (cmd as any).getLengthStepData();
            // point essentially on the section plane → dist ≈ 0
            expect(data.preview(new XYZ({ x: 1, y: 2, z: 0 }))).toEqual([]);
        });

        test("preview of a planar face should mesh a prism", () => {
            const cmd = buildFaceCommand(true, () => ({ isPlanar: () => true }));
            const data = (cmd as any).getLengthStepData();
            const preview = data.preview(new XYZ({ x: 0, y: 0, z: 4 }));
            expect(Array.isArray(preview)).toBe(true);
            expect(preview).toHaveLength(1);
        });

        test("preview of a non-planar face should mesh a thick solid", () => {
            const cmd = buildFaceCommand(false, () => ({ isPlanar: () => false }));
            const data = (cmd as any).getLengthStepData();
            const preview = data.preview(new XYZ({ x: 0, y: 0, z: 4 }));
            expect(Array.isArray(preview)).toBe(true);
            expect(preview).toHaveLength(1);
        });

        test("preview of an edge section should mesh a prism (no surface branch)", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            // An edge whose curve normal is +Z (vec parallel to X → cross gives Z).
            seedStepDatas(cmd, [
                shapeStepResult([
                    {
                        shape: {
                            shapeType: ShapeTypes.edge,
                            curve: {
                                basisCurve: { axis: undefined, dn: () => XYZ.unitX, direction: undefined },
                            },
                            isClosed: () => false,
                        } as Partial<IShape>,
                        point: XYZ.zero,
                    },
                ]),
            ]);
            const data = (cmd as any).getLengthStepData();
            const preview = data.preview(new XYZ({ x: 0, y: 0, z: 2 }));
            expect(Array.isArray(preview)).toBe(true);
            expect(preview).toHaveLength(1);
        });
    });

    // Multi-edge selection support: a user sketching a rectangle with 4
    // separate Line-tool clicks gets 4 disconnected top-level nodes, not one
    // closed wire. buildSection lets Extrude accept that set directly and
    // build the missing face itself, reusing FaceNode's edge-joining logic.
    describe("buildSection", () => {
        test("single shape is passed through as-is and tracked for dispose when requested", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            const step = shapeStepResult([{ shape: { shapeType: ShapeTypes.face } }]);

            const result = (cmd as any).buildSection(step, true);

            expect(result.isOk).toBe(true);
            expect((cmd as any).disposeStack.has(result.value)).toBe(true);
        });

        test("single shape is not tracked for dispose when shouldDispose is false", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            const step = shapeStepResult([{ shape: { shapeType: ShapeTypes.face } }]);

            const result = (cmd as any).buildSection(step, false);

            expect(result.isOk).toBe(true);
            expect((cmd as any).disposeStack.has(result.value)).toBe(false);
        });

        test("multiple connected edges are joined into a single face via FaceNode", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            const mockFace = createMockShape();
            const wire = rs.fn((_edges: IEdge[]) => Result.ok(createMockWire()));
            const face = rs.fn((_wires: IWire[]) => Result.ok(mockFace));
            const restore = stubShapeFactory({ wire, face });
            try {
                // A closed rectangle, exactly the shape a user gets from 4
                // separate Line-tool clicks on top of a box face.
                const step = shapeStepResult([
                    { shape: mockEdgeShape(0, 0, 10, 0) },
                    { shape: mockEdgeShape(10, 0, 10, 10) },
                    { shape: mockEdgeShape(10, 10, 0, 10) },
                    { shape: mockEdgeShape(0, 10, 0, 0) },
                ]);

                const result = (cmd as any).buildSection(step, false);

                expect(result.isOk).toBe(true);
                expect(result.value).toBe(mockFace);
                expect(wire).toHaveBeenCalledTimes(1);
                expect(wire.mock.calls[0][0]).toHaveLength(4);
                expect(face).toHaveBeenCalledTimes(1);
            } finally {
                restore();
            }
        });

        test("disposes the raw transformed edges once the face is built", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            const restore = stubShapeFactory({
                wire: () => Result.ok(createMockWire()),
                face: () => Result.ok(createMockShape()),
            });
            try {
                const disposed: unknown[] = [];
                const edges = [
                    mockEdgeShape(0, 0, 10, 0),
                    mockEdgeShape(10, 0, 10, 10),
                    mockEdgeShape(10, 10, 0, 10),
                    mockEdgeShape(0, 10, 0, 0),
                ].map((shape) => ({ ...shape, dispose: () => disposed.push(shape) }));
                const step = shapeStepResult(edges.map((shape) => ({ shape })));

                (cmd as any).buildSection(step, false);

                expect(disposed).toHaveLength(4);
            } finally {
                restore();
            }
        });

        test("multiple shapes including a face are rejected without calling shapeFactory", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            const wire = rs.fn();
            const restore = stubShapeFactory({ wire });
            try {
                const step = shapeStepResult([
                    { shape: { shapeType: ShapeTypes.face } },
                    { shape: mockEdgeShape(0, 0, 10, 0) },
                ]);

                const result = (cmd as any).buildSection(step, false);

                expect(result.isOk).toBe(false);
                expect(wire).not.toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        test("a FaceNode exception (open profile) is caught and converted to Result.err", () => {
            const cmd = new ExtrudeCommand();
            wireCommand(cmd);
            const restore = stubShapeFactory({ wire: () => Result.err("cannot create wire") });
            try {
                // Two connected edges that never close back on themselves - one
                // group, but shapeFactory.wire fails, so FaceNode.getWires()
                // throws rather than returning Result.err.
                const step = shapeStepResult([
                    { shape: mockEdgeShape(0, 0, 10, 0) },
                    { shape: mockEdgeShape(10, 0, 20, 0) },
                ]);

                const result = (cmd as any).buildSection(step, false);

                expect(result.isOk).toBe(false);
                expect(result.error).toBe("Cannot create wire from open shapes");
            } finally {
                restore();
            }
        });
    });

    describe("SelectExtrudeSectionStep (getSteps()[0])", () => {
        function buildStepWithPreselection(shapes: unknown[]) {
            const cmd = new ExtrudeCommand();
            const { doc } = wireCommand(cmd);
            (doc as any).application = { activeView: {} };
            (doc.selection as any).getSelectedShapes = () => shapes;
            const step = (cmd as any).getSteps()[0];
            return { doc, step };
        }

        test("passes a valid multi-edge pre-selection through, resolving the controller", async () => {
            const restore = stubShapeFactory({
                wire: () => Result.ok(createMockWire()),
                face: () => Result.ok(createMockShape()),
            });
            try {
                const shapes = [
                    shapeData({ shape: mockEdgeShape(0, 0, 10, 0) }),
                    shapeData({ shape: mockEdgeShape(10, 0, 10, 10) }),
                    shapeData({ shape: mockEdgeShape(10, 10, 0, 10) }),
                    shapeData({ shape: mockEdgeShape(0, 10, 0, 0) }),
                ];
                const { doc, step } = buildStepWithPreselection(shapes);
                const controller = { success: rs.fn() } as any;

                const result = await step.execute(doc, controller);

                expect(result?.shapes).toHaveLength(4);
                expect(controller.success).toHaveBeenCalled();
            } finally {
                restore();
            }
        });

        test("aborts with a toast when the pre-selection can't form a closed profile", async () => {
            const restore = stubShapeFactory({ wire: () => Result.err("cannot create wire") });
            const shapes = [
                shapeData({ shape: mockEdgeShape(0, 0, 10, 0) }),
                shapeData({ shape: mockEdgeShape(10, 0, 20, 0) }),
            ];
            const { doc, step } = buildStepWithPreselection(shapes);
            const controller = { success: rs.fn() } as any;
            const pubSpy = rs.spyOn(PubSub.default, "pub").mockImplementation(() => {});

            try {
                const result = await step.execute(doc, controller);
                expect(result).toBeUndefined();
                expect(pubSpy).toHaveBeenCalledWith(
                    "showToast",
                    "error.default:{0}",
                    "Cannot create wire from open shapes",
                );
            } finally {
                pubSpy.mockRestore();
                restore();
            }
        });

        test("a single pre-selected shape passes through without joining logic", async () => {
            const { doc, step } = buildStepWithPreselection([
                shapeData({ shape: { shapeType: ShapeTypes.face } }),
            ]);
            const controller = { success: rs.fn() } as any;

            const result = await step.execute(doc, controller);

            expect(result?.shapes).toHaveLength(1);
        });

        // Construction geometry is a drawing guide, not real profile material
        // (matches FreeCAD) - it should never itself become the shape an
        // Extrude turns into a solid.
        test("excludes a construction shape from a mixed pre-selection", async () => {
            const { doc, step } = buildStepWithPreselection([]);
            const constructionNode = new EditableShapeNode({
                document: doc,
                name: "construction",
                shape: Result.ok(createMockShape({ shapeType: ShapeTypes.face })),
            });
            constructionNode.isConstruction = true;
            const normalNode = new EditableShapeNode({
                document: doc,
                name: "normal",
                shape: Result.ok(createMockShape({ shapeType: ShapeTypes.face })),
            });
            (doc.selection as any).getSelectedShapes = () => [
                shapeData({ shape: { shapeType: ShapeTypes.face }, node: constructionNode }),
                shapeData({ shape: { shapeType: ShapeTypes.face }, node: normalNode }),
            ];
            const controller = { success: rs.fn() } as any;

            const result = await step.execute(doc, controller);

            expect(result?.shapes).toHaveLength(1);
            expect(result?.nodes?.[0]).toBe(normalNode);
        });
    });
});
