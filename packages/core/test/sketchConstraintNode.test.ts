// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CoincidentConstraint,
    DistanceConstraint,
    EqualConstraint,
    HorizontalConstraint,
    type IDocument,
    InternalClassName,
    ParallelConstraint,
    PerpendicularConstraint,
    Serializer,
    SketchConstraintNode,
    SketchPointHandle,
    VerticalConstraint,
} from "../src";
import { TestDocument } from "../test-utils";

const p1 = new SketchPointHandle({ nodeId: "line1", role: "start" });
const p2 = new SketchPointHandle({ nodeId: "line1", role: "end" });

describe("SketchConstraintNode", () => {
    const doc: IDocument = new TestDocument() as any;

    test("wraps the given constraint", () => {
        const constraint = new CoincidentConstraint({ p1, p2 });
        const node = new SketchConstraintNode({ document: doc, constraint });
        expect(node.constraint).toBe(constraint);
    });

    // The test i18n setup (`@chili3d/core/test-utils`) registers an identity
    // locale - I18n.translate(key) returns the raw key itself - so `name`
    // (translated at construction time, like ParameterShapeNode does) reads
    // as the i18n key here, not real English text.
    test("derives its name from the constraint kind", () => {
        const node = new SketchConstraintNode({
            document: doc,
            constraint: new CoincidentConstraint({ p1, p2 }),
        });
        expect(node.name).toBe("body.constraint.coincident");
    });

    test.each([
        [new HorizontalConstraint({ p1, p2 }), "body.constraint.horizontal"],
        [new VerticalConstraint({ p1, p2 }), "body.constraint.vertical"],
        [new ParallelConstraint({ a1: p1, a2: p2, b1: p1, b2: p2 }), "body.constraint.parallel"],
        [new PerpendicularConstraint({ a1: p1, a2: p2, b1: p1, b2: p2 }), "body.constraint.perpendicular"],
        [new EqualConstraint({ a1: p1, a2: p2, b1: p1, b2: p2 }), "body.constraint.equal"],
    ])("names itself after each constraint kind (%#)", (constraint, expectedKey) => {
        const node = new SketchConstraintNode({ document: doc, constraint });
        expect(node.name).toBe(expectedKey);
    });

    test("boundingBox is undefined - a constraint marker has nothing to bound", () => {
        const node = new SketchConstraintNode({
            document: doc,
            constraint: new CoincidentConstraint({ p1, p2 }),
        });
        expect(node.boundingBox()).toBeUndefined();
    });

    test("uses the given id when provided, otherwise generates one", () => {
        const constraint = new CoincidentConstraint({ p1, p2 });
        const withId = new SketchConstraintNode({ document: doc, constraint, id: "fixed-id" });
        const withoutId = new SketchConstraintNode({ document: doc, constraint });
        expect(withId.id).toBe("fixed-id");
        expect(withoutId.id).not.toBe("fixed-id");
        expect(typeof withoutId.id).toBe("string");
    });

    describe("distance", () => {
        test("is undefined for every constraint kind except DistanceConstraint", () => {
            const node = new SketchConstraintNode({
                document: doc,
                constraint: new CoincidentConstraint({ p1, p2 }),
            });
            expect(node.distance).toBeUndefined();
        });

        test("reads the wrapped DistanceConstraint's value", () => {
            const node = new SketchConstraintNode({
                document: doc,
                constraint: new DistanceConstraint({ p1, p2, distance: 50 }),
            });
            expect(node.distance).toBe(50);
        });

        test("setting it updates the constraint, emits a change, and records an undoable step", () => {
            const localDoc = new TestDocument() as unknown as IDocument;
            const constraint = new DistanceConstraint({ p1, p2, distance: 50 });
            const node = new SketchConstraintNode({ document: localDoc, constraint });
            const before = localDoc.history.undoCount();

            node.distance = 75;

            expect(constraint.distance).toBe(75);
            expect(node.distance).toBe(75);
            expect(localDoc.history.undoCount()).toBe(before + 1);

            localDoc.history.undo();
            expect(constraint.distance).toBe(50);

            localDoc.history.redo();
            expect(constraint.distance).toBe(75);
        });

        test("setting it on a non-DistanceConstraint node is a no-op", () => {
            const localDoc = new TestDocument() as unknown as IDocument;
            const node = new SketchConstraintNode({
                document: localDoc,
                constraint: new CoincidentConstraint({ p1, p2 }),
            });
            const before = localDoc.history.undoCount();

            node.distance = 75;

            expect(node.distance).toBeUndefined();
            expect(localDoc.history.undoCount()).toBe(before);
        });

        test("setting the same value is a no-op - no extra undo step", () => {
            const localDoc = new TestDocument() as unknown as IDocument;
            const constraint = new DistanceConstraint({ p1, p2, distance: 50 });
            const node = new SketchConstraintNode({ document: localDoc, constraint });
            const before = localDoc.history.undoCount();

            node.distance = 50;

            expect(localDoc.history.undoCount()).toBe(before);
        });
    });

    describe("serialization", () => {
        test("round-trips through the class registry, including the nested constraint", () => {
            const constraint = new CoincidentConstraint({ p1, p2 });
            const original = new SketchConstraintNode({ document: doc, constraint, id: "node-1" });

            const serialized = Serializer.serializeObject(original);
            expect(serialized[InternalClassName]).toBe("SketchConstraintNode");

            const restored = Serializer.deserializeObject(doc, serialized) as SketchConstraintNode;
            expect(restored).toBeInstanceOf(SketchConstraintNode);
            expect(restored.id).toBe("node-1");
            expect(restored.name).toBe("body.constraint.coincident");
            expect(restored.constraint).toBeInstanceOf(CoincidentConstraint);
            expect((restored.constraint as CoincidentConstraint).p1.nodeId).toBe("line1");
            expect((restored.constraint as CoincidentConstraint).p1.role).toBe("start");
        });
    });
});
