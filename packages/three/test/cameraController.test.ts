// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument } from "@chili3d/core";
import { createMockSelection } from "@chili3d/core/test-utils";
import {
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    Raycaster,
    Scene,
    Vector2,
    Vector3,
} from "three";
import { CameraController } from "../src/cameraController";
import { Constants } from "../src/constants";
import type { ThreeHighlighter } from "../src/threeHighlighter";
import type { ThreeView } from "../src/threeView";
import type { ThreeVisualContext } from "../src/threeVisualContext";

/**
 * Create a minimal fake ThreeView that CameraController needs for its operations.
 * Only the properties/methods actually called by the tested code are provided.
 */
function createFakeView(overrides: Partial<ThreeView> = {}): ThreeView {
    const scene = new Scene();
    const visualShapes = new Object3D();
    scene.add(visualShapes);

    return {
        get mode() {
            return "solidAndWireframe" as const;
        },
        get document(): IDocument {
            return {
                selection: createMockSelection(),
                visual: {
                    context: {
                        visualShapes,
                        getVisual() {
                            return undefined;
                        },
                    },
                },
            } as unknown as IDocument;
        },
        screenToCameraRect(_x: number, _y: number) {
            return { x: 0, y: 0 };
        },
        content: {
            visualShapes,
        } as unknown as ThreeVisualContext,
        detectVisual(_x: number, _y: number) {
            return [];
        },
        highlighter: {} as ThreeHighlighter,
        ...overrides,
    } as unknown as ThreeView;
}

// ============================================================================
// CameraController — construction and defaults
// ============================================================================

describe("CameraController — construction", () => {
    test("creates with perspective camera by default", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        expect(cc.cameraType).toBe("perspective");
        expect(cc.camera).toBeInstanceOf(PerspectiveCamera);
    });

    test("camera starts at default position", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        // Default position: (1500, 1500, 1500)
        expect(cc.cameraPosition.x).toBeCloseTo(1500);
        expect(cc.cameraPosition.y).toBeCloseTo(1500);
        expect(cc.cameraPosition.z).toBeCloseTo(1500);
    });

    test("target defaults to origin", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        expect(cc.target.x).toBe(0);
        expect(cc.target.y).toBe(0);
        expect(cc.target.z).toBe(0);
    });

    test("cameraUp defaults to Y-up", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        // Three.js cameras default up is (0, 1, 0)
        expect(cc.cameraUp.y).toBeCloseTo(1);
    });
});

// ============================================================================
// CameraController — cameraType switching
// ============================================================================

describe("CameraController — cameraType", () => {
    test("switching to orthographic creates OrthographicCamera", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.cameraType = "orthographic";
        expect(cc.cameraType).toBe("orthographic");
        expect(cc.camera).toBeInstanceOf(OrthographicCamera);
    });

    test("switching back to perspective", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.cameraType = "orthographic";
        cc.cameraType = "perspective";
        expect(cc.cameraType).toBe("perspective");
        expect(cc.camera).toBeInstanceOf(PerspectiveCamera);
    });

    test("setting same cameraType keeps the camera instance", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        const camera = cc.camera;
        cc.cameraType = "perspective"; // same as current
        expect(cc.cameraType).toBe("perspective");
        expect(cc.camera).toBe(camera);
    });
});

// ============================================================================
// CameraController — lookAt
// ============================================================================

describe("CameraController — lookAt", () => {
    test("lookAt sets eye position", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.lookAt({ x: 100, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
        expect(cc.cameraPosition.x).toBeCloseTo(100);
        expect(cc.cameraPosition.y).toBeCloseTo(0);
        expect(cc.cameraPosition.z).toBeCloseTo(0);
    });

    test("lookAt sets target", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.lookAt({ x: 100, y: 100, z: 100 }, { x: 10, y: 20, z: 30 }, { x: 0, y: 0, z: 1 });
        expect(cc.target.x).toBeCloseTo(10);
        expect(cc.target.y).toBeCloseTo(20);
        expect(cc.target.z).toBeCloseTo(30);
    });
});

// ============================================================================
// CameraController — setSize
// ============================================================================

describe("CameraController — setSize", () => {
    test("setSize updates aspect ratio for perspective camera", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.setSize(800, 600);
        const cam = cc.camera as PerspectiveCamera;
        expect(cam.aspect).toBeCloseTo(800 / 600);
    });

    test("setSize updates the frustum for orthographic camera", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.cameraType = "orthographic";
        cc.setSize(800, 600);

        const cam = cc.camera as OrthographicCamera;
        const distance = Math.sqrt(3 * 1500 * 1500);
        const halfHeight = distance * Math.tan((25 * Math.PI) / 180);
        expect(cam.top).toBeCloseTo(halfHeight);
        expect(cam.bottom).toBeCloseTo(-halfHeight);
        expect(cam.right / cam.left).toBeCloseTo(-1);
        expect(cam.right / cam.top).toBeCloseTo(800 / 600);
    });
});

// ============================================================================
// CameraController — pan
// ============================================================================

describe("CameraController — pan", () => {
    test("pan moves target from initial position", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        const origTarget = cc.target.clone();
        cc.pan(100, 0);
        // Target should have moved
        expect(cc.target.x).not.toBeCloseTo(origTarget.x);
    });

    test("pan with zero deltas keeps target and position", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.pan(0, 0);
        expect(cc.target.x).toBe(0);
        expect(cc.target.y).toBe(0);
        expect(cc.target.z).toBe(0);
        expect(cc.cameraPosition.x).toBeCloseTo(1500);
        expect(cc.cameraPosition.y).toBeCloseTo(1500);
        expect(cc.cameraPosition.z).toBeCloseTo(1500);
    });
});

// ============================================================================
// CameraController — rotate
// ============================================================================

describe("CameraController — rotate", () => {
    test("rotate changes camera position", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        const origPos = cc.cameraPosition;
        cc.rotate(10, 0);
        // Rotation should have changed the position
        expect(cc.cameraPosition.x).not.toBeCloseTo(origPos.x);
    });

    test("rotate with zero deltas repositions the camera on the +Z axis of the target", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        const distance = Math.sqrt(3 * 1500 * 1500);
        cc.rotate(0, 0);
        // With an identity camera quaternion the eye is placed at target + (0, 0, distance)
        expect(cc.cameraPosition.x).toBeCloseTo(0);
        expect(cc.cameraPosition.y).toBeCloseTo(0);
        expect(cc.cameraPosition.z).toBeCloseTo(distance);
        expect(cc.cameraPosition.distanceTo(cc.cameraTarget)).toBeCloseTo(distance);
    });
});

// ============================================================================
// CameraController — zoom
// ============================================================================

describe("CameraController — zoom", () => {
    test("zoom changes camera position", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        const origDist = cc.cameraPosition.distanceTo(cc.cameraTarget);
        cc.zoom(400, 300, 120);
        const newDist = cc.cameraPosition.distanceTo(cc.cameraTarget);
        // Zoom should change the distance
        expect(newDist).not.toBeCloseTo(origDist);
    });

    test("zoom with zero delta still applies the negative zoom factor", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        const origDist = cc.cameraPosition.distanceTo(cc.cameraTarget);
        cc.zoom(400, 300, 0);
        // delta=0 takes the `delta > 0 ? f : -f` else-branch, so the distance
        // is scaled by (1 - 0.1) instead of staying unchanged.
        expect(cc.cameraPosition.distanceTo(cc.cameraTarget)).toBeCloseTo(origDist * 0.9);
    });
});

describe("CameraController — orthographic close-up", () => {
    function createPartView() {
        const view = createFakeView();
        const part = new Mesh(new BoxGeometry(200, 200, 200), new MeshBasicMaterial());
        view.content.visualShapes.add(part);
        const cc = new CameraController(view);
        cc.setSize(800, 600);
        cc.lookAt({ x: 0, y: 0, z: 500 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
        cc.cameraType = "orthographic";
        return { cc, part };
    }

    test.each([
        [0, 0, 500],
        [0, -500, 0],
        [500, 500, 500],
    ])("keeps the entire depth visible while zooming from (%s, %s, %s)", (x, y, z) => {
        const { cc, part } = createPartView();
        try {
            cc.lookAt({ x, y, z }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 1 });
            const initialWidth = (cc.camera as OrthographicCamera).right * 2;
            for (let i = 0; i < 60; i++) cc.zoom(400, 300, -120);

            const camera = cc.camera as OrthographicCamera;
            expect(camera.right * 2).toBeLessThan(initialWidth / 100);
            camera.updateMatrixWorld(true);
            for (const px of [-100, 100]) {
                for (const py of [-100, 100]) {
                    for (const pz of [-100, 100]) {
                        const depth = new Vector3(px, py, pz).project(camera).z;
                        expect(depth).toBeGreaterThan(-1);
                        expect(depth).toBeLessThan(1);
                    }
                }
            }
            const ray = new Raycaster();
            ray.setFromCamera(new Vector2(0, 0), camera);
            expect(ray.intersectObject(part).length).toBeGreaterThan(0);
        } finally {
            part.geometry.dispose();
            part.material.dispose();
        }
    });

    test("keeps the point under the cursor fixed after the camera retreats", () => {
        const { cc, part } = createPartView();
        try {
            for (let i = 0; i < 30; i++) cc.zoom(400, 300, -120);
            cc.camera.updateMatrixWorld(true);
            const point = new Vector3(0.5, 0.5, 0).unproject(cc.camera);
            cc.zoom(600, 150, -120);
            cc.camera.updateMatrixWorld(true);
            const projected = point.project(cc.camera);
            expect(projected.x).toBeCloseTo(0.5, 6);
            expect(projected.y).toBeCloseTo(0.5, 6);
            expect(cc.cameraTarget.z).toBeCloseTo(0, 6);
        } finally {
            part.geometry.dispose();
            part.material.dispose();
        }
    });

    test("keeps foreground and distant geometry inside the depth range at close range", () => {
        const { cc, part } = createPartView();
        const distantPart = part.clone();
        const view = cc.view;
        part.position.z = 5000;
        distantPart.position.z = -5000;
        view.content.visualShapes.add(distantPart);
        try {
            cc.lookAt({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
            for (const z of [-5100, -4900, 4900, 5100]) {
                const depth = new Vector3(0, 0, z).project(cc.camera).z;
                expect(depth).toBeGreaterThan(-1);
                expect(depth).toBeLessThan(1);
            }
            const ray = new Raycaster();
            ray.setFromCamera(new Vector2(0, 0), cc.camera);
            const hits = ray.intersectObjects(view.content.visualShapes.children);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].object).toBe(part);
            expect(hits[0].point.z).toBeCloseTo(5100);
        } finally {
            part.geometry.dispose();
            part.material.dispose();
        }
    });

    test("preserves close-up framing across resize, rotation, and saved-view restore", () => {
        const { cc, part } = createPartView();
        try {
            for (let i = 0; i < 30; i++) cc.zoom(400, 300, -120);
            const top = (cc.camera as OrthographicCamera).top;
            const eye = cc.cameraPosition;
            const target = cc.cameraTarget;
            const up = cc.cameraUp;
            cc.setSize(1000, 600);
            expect((cc.camera as OrthographicCamera).top).toBeCloseTo(top);
            cc.rotate(30, 20);
            expect((cc.camera as OrthographicCamera).top).toBeCloseTo(top);
            cc.fitContent();
            expect((cc.camera as OrthographicCamera).top).toBeGreaterThan(top);
            cc.lookAt(eye, target, up);
            expect((cc.camera as OrthographicCamera).top).toBeCloseTo(top);
        } finally {
            part.geometry.dispose();
            part.material.dispose();
        }
    });
});

// ============================================================================
// CameraController — startRotate
// ============================================================================

describe("CameraController — startRotate", () => {
    test("startRotate with no selection and no detected shape sets no rotate center", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.startRotate(400, 300);
        expect((cc as any)._rotateCenter).toBeUndefined();

        // Without a rotate center, rotate orbits the target and keeps it fixed
        cc.rotate(10, 0);
        expect(cc.target.x).toBeCloseTo(0);
        expect(cc.target.y).toBeCloseTo(0);
        expect(cc.target.z).toBeCloseTo(0);
    });
});

// ============================================================================
// CameraController — fitContent
// ============================================================================

describe("CameraController — fitContent", () => {
    function addBoxMesh(view: ThreeView, halfSize: number) {
        const geo = new BufferGeometry();
        const s = halfSize;
        geo.setAttribute(
            "position",
            new BufferAttribute(new Float32Array([-s, -s, -s, s, -s, -s, s, s, s, -s, s, s]), 3),
        );
        const mesh = new Mesh(geo, new MeshBasicMaterial());
        (view.content.visualShapes as Object3D).add(mesh);
        return mesh;
    }

    test("fitContent on empty scene falls back to the default sphere radius", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.fitContent();

        // Empty scene produces an invalid sphere, so SHAPE_EMPTY_SIZE (800) is used
        const expectedDistance = 800 / Math.sin((25 * Math.PI) / 180);
        expect(cc.target.x).toBeCloseTo(0);
        expect(cc.target.y).toBeCloseTo(0);
        expect(cc.target.z).toBeCloseTo(0);
        expect(cc.cameraPosition.distanceTo(cc.cameraTarget)).toBeCloseTo(expectedDistance);
        expect(cc.camera.near).toBeCloseTo(expectedDistance / 1000);
        expect(cc.camera.far).toBeCloseTo(expectedDistance * 100);
    });

    test("fitContent frames the bounding sphere of the scene content", () => {
        const view = createFakeView();
        addBoxMesh(view, 10);
        const cc = new CameraController(view);
        cc.fitContent();

        const radius = Math.sqrt(3 * 10 * 10);
        const expectedDistance = radius / Math.sin((25 * Math.PI) / 180);
        expect(cc.target.x).toBeCloseTo(0);
        expect(cc.target.y).toBeCloseTo(0);
        expect(cc.target.z).toBeCloseTo(0);
        expect(cc.cameraPosition.distanceTo(cc.cameraTarget)).toBeCloseTo(expectedDistance);
    });

    test("fitContent with orthographic camera updates the frustum", () => {
        const view = createFakeView();
        addBoxMesh(view, 10);
        const cc = new CameraController(view);
        cc.cameraType = "orthographic";
        cc.fitContent();

        const radius = Math.sqrt(3 * 10 * 10);
        const expectedDistance = radius / Math.sin((25 * Math.PI) / 180);
        const cam = cc.camera as OrthographicCamera;
        expect(cam.top).toBeCloseTo(expectedDistance * Math.tan((25 * Math.PI) / 180));
        expect(cc.cameraPosition.distanceTo(cc.cameraTarget)).toBeCloseTo(expectedDistance);
    });
});

// ============================================================================
// CameraController — setCameraLayer
// ============================================================================

describe("CameraController — setCameraLayer", () => {
    test("wireframe mode enables wireframe layer", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.setCameraLayer(cc.camera, "wireframe");
        expect(cc.camera.layers.isEnabled(Constants.Layers.Wireframe)).toBe(true);
    });

    test("solid mode enables solid layer", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.setCameraLayer(cc.camera, "solid");
        expect(cc.camera.layers.isEnabled(Constants.Layers.Solid)).toBe(true);
    });

    test("solidAndWireframe mode enables all layers", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.setCameraLayer(cc.camera, "solidAndWireframe");
        // Both layers should be enabled
        expect(cc.camera.layers.isEnabled(Constants.Layers.Wireframe)).toBe(true);
        expect(cc.camera.layers.isEnabled(Constants.Layers.Solid)).toBe(true);
    });
});

// ============================================================================
// CameraController — updateCameraPosionTarget
// ============================================================================

describe("CameraController — updateCameraPosionTarget", () => {
    test("updateCameraPosionTarget syncs camera", () => {
        const view = createFakeView();
        const cc = new CameraController(view);
        cc.lookAt({ x: 200, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
        expect(cc.camera.position.x).toBeCloseTo(200);
    });
});
