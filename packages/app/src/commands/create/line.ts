// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    command,
    Dimensions,
    type GeometryNode,
    type IEdge,
    type IStep,
    type PointSnapData,
    PointStep,
    Precision,
    property,
    Result,
    Transaction,
    type XYZ,
} from "@chili3d/core";
import { LineNode } from "../../bodys";
import { FaceNode } from "../../bodys/face";
import { CreateCommand } from "../createCommand";

@command({
    key: "create.line",
    icon: "icon-line",
})
export class Line extends CreateCommand {
    @property("option.command.isConnected")
    get isContinue() {
        return this.getPrivateValue("isContinue", true);
    }
    set isContinue(value: boolean) {
        this.setProperty("isContinue", value);
    }

    /** Segments drawn so far in the current connected chain (see isContinue),
     * tracked so a chain that closes back on its own start point can be
     * auto-converted into a face instead of staying as separate open edges. */
    private _chainStart: XYZ | undefined;
    private _chainNodes: LineNode[] = [];
    private _lastCreatedNode: LineNode | undefined;

    protected override geometryNode(): GeometryNode {
        const node = new LineNode({
            document: this.document,
            start: this.stepDatas[0].point!,
            end: this.stepDatas[1].point!,
        });
        this._lastCreatedNode = node;
        return node;
    }

    protected override executeMainTask(): void {
        super.executeMainTask();
        this.repeatOperation = true;
        this.trackChainAndCloseIfLooped();
    }

    private trackChainAndCloseIfLooped(): void {
        const node = this._lastCreatedNode;
        this._lastCreatedNode = undefined;
        if (!node) return;

        if (!this.isContinue) {
            this.resetChainTracking();
            return;
        }

        if (this._chainNodes.length === 0) {
            this._chainStart = node.start;
        }
        this._chainNodes.push(node);

        // A closed profile needs at least 3 edges; only close once the new
        // segment's end lands back on where the chain started.
        if (this._chainNodes.length >= 3 && node.end.distanceTo(this._chainStart!) < Precision.Distance) {
            this.closeChainIntoFace();
        }
    }

    private closeChainIntoFace(): void {
        const nodes = this._chainNodes;
        this.resetChainTracking();

        // Clone each edge rather than handing FaceNode the LineNodes' own
        // shape instances - those get disposed below when their owning
        // nodes are removed, and FaceNode keeps `shapes` as its own
        // persistent parametric input (re-read on every future regenerate).
        const edges: IEdge[] = [];
        for (const node of nodes) {
            const shape = node.shape;
            if (!shape.isOk) return;
            edges.push(shape.value.clone() as IEdge);
        }

        let face: Result<GeometryNode>;
        try {
            const faceNode = new FaceNode({ document: this.document, shapes: edges });
            const shape = faceNode.generateShape();
            face = shape.isOk ? Result.ok(faceNode) : Result.err(shape.error);
        } catch (e) {
            face = Result.err(e instanceof Error ? e.message : String(e));
        }
        // Not a valid closed planar profile (e.g. the sketched loop isn't
        // flat) - leave the individual line segments as they are.
        if (!face.isOk) return;

        Transaction.execute(this.document, "close sketch loop into face", () => {
            nodes.forEach((n) => n.parent?.remove(n));
            this.document.modelManager.addNode(face.value);
        });
        this.document.visual.update();
    }

    private resetChainTracking(): void {
        this._chainStart = undefined;
        this._chainNodes = [];
    }

    getSteps(): IStep[] {
        const firstStep = new PointStep("prompt.pickFistPoint");
        const secondStep = new PointStep("prompt.pickNextPoint", this.getSecondPointData);
        return [firstStep, secondStep];
    }

    protected override resetStepDatas() {
        if (this.isContinue) {
            this.stepDatas[0] = this.stepDatas[1];
            this.stepDatas.length = 1;
        } else {
            this.stepDatas.length = 0;
        }
    }

    private readonly getSecondPointData = (): PointSnapData => {
        return {
            refPoint: () => this.stepDatas[0].point!,
            dimension: Dimensions.D1D2D3,
            validator: (point: XYZ) => {
                return this.stepDatas[0].point!.distanceTo(point) > Precision.Distance;
            },
            preview: this.linePreview,
        };
    };

    private readonly linePreview = (point: XYZ | undefined) => {
        if (!point) {
            return [this.meshPoint(this.stepDatas[0].point!)];
        }
        return [this.meshPoint(this.stepDatas[0].point!), this.meshLine(this.stepDatas[0].point!, point)];
    };
}
