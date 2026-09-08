// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument } from "../document";
import { Id } from "../foundation";
import type { I18nKeys } from "../i18n";
import { BoundingBox, type XYZ } from "../math";
import { serializable, serialize } from "../serialize";
import { Node } from "./node";
import { VisualNode } from "./visualNode";

export const AnnotationTypes = ["dimension", "text", "refInfiniteLine", "refSegment"] as const;
export type AnnotationType = (typeof AnnotationTypes)[number];

interface AnnotationOptionsBase {
    document: IDocument;
    annotationType: AnnotationType;
    name: string;
    id?: string;
    color?: number;
    visible?: boolean;
}

export type DimensionType = "linear" | "radial" | "diameter" | "angle";

export interface DimensionAnnotationOptions extends AnnotationOptionsBase {
    annotationType: "dimension";
    /** Linear: the two measured points. Radial/diameter: the circle's center.
     * Angle: the shared vertex the two edges are measured from. */
    startPoint: XYZ;
    /** Linear: unused (kept equal to startPoint). Radial/diameter: a point on
     * the circle. Angle: a point along the first edge (endPoint - startPoint
     * gives that edge's direction). */
    endPoint: XYZ;
    /** Angle only: a point along the second edge (point2 - startPoint gives
     * that edge's direction). Unused by every other dimension type. */
    point2?: XYZ;
    /** Where the user clicked to place the dimension line/label - for a linear
     * dimension this also sets which side (and how far) the extension lines
     * offset to; an aligned dimension parallel to startPoint->endPoint covers
     * horizontal/vertical too, since those are just the degenerate cases
     * where the measured segment already runs along one axis. For an angle
     * dimension it sets the arc's radius (distance from the vertex). */
    placement: XYZ;
    dimensionType?: DimensionType;
    /** Overrides the displayed value instead of deriving it from the points
     * (a "reference" dimension) - rarely needed, but keeps the annotation
     * useful even when the exact geometric distance isn't what should show. */
    value?: number;
}

export interface TextAnnotationOptions extends AnnotationOptionsBase {
    annotationType: "text";
    content: string;
    position: XYZ;
}

export interface RefInfiniteLineAnnotationOptions extends AnnotationOptionsBase {
    annotationType: "refInfiniteLine";
    point: XYZ;
    direction: XYZ;
}

export interface RefSegmentAnnotationOptions extends AnnotationOptionsBase {
    annotationType: "refSegment";
    startPoint: XYZ;
    endPoint: XYZ;
}

export type AnnotationOptions =
    | DimensionAnnotationOptions
    | TextAnnotationOptions
    | RefInfiniteLineAnnotationOptions
    | RefSegmentAnnotationOptions;

export abstract class Annotation extends VisualNode {
    @serialize()
    readonly annotationType: AnnotationType;

    @serialize()
    get color(): number {
        return this.getPrivateValue("color", 0xffff00);
    }
    set color(value: number) {
        this.setProperty("color", value);
    }

    constructor(options: AnnotationOptionsBase) {
        super(options.document, options.name, options.id ?? Id.generate());
        this.annotationType = options.annotationType;
        if (options.color !== undefined) this.setPrivateValue("color", options.color);
        if (options.visible !== undefined) this.visible = options.visible;
    }

    override display(): I18nKeys {
        return "annotation" as I18nKeys;
    }
    override boundingBox(): BoundingBox | undefined {
        return undefined;
    }
}

@serializable()
export class DimensionAnnotation extends Annotation {
    declare readonly annotationType: "dimension";

    @serialize()
    get startPoint(): XYZ {
        return this.getPrivateValue("startPoint");
    }
    set startPoint(value: XYZ) {
        this.setProperty("startPoint", value);
    }

    @serialize()
    get endPoint(): XYZ {
        return this.getPrivateValue("endPoint");
    }
    set endPoint(value: XYZ) {
        this.setProperty("endPoint", value);
    }

    @serialize()
    get point2(): XYZ | undefined {
        return this.getPrivateValue("point2");
    }
    set point2(value: XYZ | undefined) {
        this.setProperty("point2", value);
    }

    @serialize()
    get placement(): XYZ {
        return this.getPrivateValue("placement");
    }
    set placement(value: XYZ) {
        this.setProperty("placement", value);
    }

    @serialize()
    get dimensionType(): DimensionType {
        return this.getPrivateValue("dimensionType", "linear");
    }

    @serialize()
    get value(): number | undefined {
        return this.getPrivateValue("value");
    }
    set value(value: number | undefined) {
        this.setProperty("value", value);
    }

    constructor(options: DimensionAnnotationOptions) {
        super(options);
        this.setPrivateValue("startPoint", options.startPoint);
        this.setPrivateValue("endPoint", options.endPoint);
        if (options.point2 !== undefined) this.setPrivateValue("point2", options.point2);
        this.setPrivateValue("placement", options.placement);
        this.setPrivateValue("dimensionType", options.dimensionType ?? "linear");
        if (options.value !== undefined) this.setPrivateValue("value", options.value);
    }

    override boundingBox(): BoundingBox | undefined {
        const points = [this.startPoint, this.endPoint, this.placement];
        if (this.point2) points.push(this.point2);
        return BoundingBox.fromPoints(points);
    }
}

@serializable()
export class TextAnnotation extends Annotation {
    declare readonly annotationType: "text";

    @serialize()
    get content(): string {
        return this.getPrivateValue("content");
    }
    set content(value: string) {
        this.setProperty("content", value);
    }

    @serialize()
    get position(): XYZ {
        return this.getPrivateValue("position");
    }
    set position(value: XYZ) {
        this.setProperty("position", value);
    }

    constructor(options: TextAnnotationOptions) {
        super(options);
        this.setPrivateValue("content", options.content);
        this.setPrivateValue("position", options.position);
    }
}

@serializable()
export class RefInfiniteLineAnnotation extends Annotation {
    declare readonly annotationType: "refInfiniteLine";

    @serialize()
    get point(): XYZ {
        return this.getPrivateValue("point");
    }
    set point(value: XYZ) {
        this.setProperty("point", value);
    }

    @serialize()
    get direction(): XYZ {
        return this.getPrivateValue("direction");
    }
    set direction(value: XYZ) {
        this.setProperty("direction", value);
    }

    constructor(options: RefInfiniteLineAnnotationOptions) {
        super(options);
        this.setPrivateValue("point", options.point);
        this.setPrivateValue("direction", options.direction);
    }
}

@serializable()
export class RefSegmentAnnotation extends Annotation {
    declare readonly annotationType: "refSegment";

    @serialize()
    get startPoint(): XYZ {
        return this.getPrivateValue("startPoint");
    }
    set startPoint(value: XYZ) {
        this.setProperty("startPoint", value);
    }

    @serialize()
    get endPoint(): XYZ {
        return this.getPrivateValue("endPoint");
    }
    set endPoint(value: XYZ) {
        this.setProperty("endPoint", value);
    }

    constructor(options: RefSegmentAnnotationOptions) {
        super(options);
        this.setPrivateValue("startPoint", options.startPoint);
        this.setPrivateValue("endPoint", options.endPoint);
    }

    override boundingBox(): BoundingBox | undefined {
        return BoundingBox.fromPoints([this.startPoint, this.endPoint]);
    }
}
