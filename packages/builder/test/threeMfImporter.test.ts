// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import JSZip from "jszip";
import { parse3mf } from "../src/threeMfImporter";

async function make3mfFile(modelXml: string, name = "test.3mf"): Promise<File> {
    const zip = new JSZip();
    zip.file("3D/3dmodel.model", modelXml);
    const blob = await zip.generateAsync({ type: "blob" });
    return new File([blob], name);
}

const SINGLE_TRIANGLE_MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" />
          <vertex x="1" y="0" z="0" />
          <vertex x="0" y="1" z="0" />
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`;

describe("parse3mf", () => {
    test("reads vertices and triangles from a single object", async () => {
        const file = await make3mfFile(SINGLE_TRIANGLE_MODEL);

        const mesh = await parse3mf(file);

        expect(mesh.vertices).toEqual([
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
        ]);
        expect(mesh.triangles).toEqual([[0, 1, 2]]);
    });

    test("merges two build items referencing two separate objects", async () => {
        const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
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
    <object id="2" type="model">
      <mesh>
        <vertices>
          <vertex x="5" y="5" z="0" />
          <vertex x="6" y="5" z="0" />
          <vertex x="5" y="6" z="0" />
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2" /></triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
    <item objectid="2" />
  </build>
</model>`;
        const file = await make3mfFile(modelXml);

        const mesh = await parse3mf(file);

        expect(mesh.vertices).toHaveLength(6);
        // Second object's triangle indices are offset past the first object's 3 vertices.
        expect(mesh.triangles).toEqual([
            [0, 1, 2],
            [3, 4, 5],
        ]);
        expect(mesh.vertices[3]).toEqual({ x: 5, y: 5, z: 0 });
    });

    test("applies a build item's transform to its object's vertices", async () => {
        const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
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
  <build>
    <item objectid="1" transform="1 0 0 0 1 0 0 0 1 10 20 30" />
  </build>
</model>`;
        const file = await make3mfFile(modelXml);

        const mesh = await parse3mf(file);

        // Identity rotation/scale, translated by (10, 20, 30).
        expect(mesh.vertices).toEqual([
            { x: 10, y: 20, z: 30 },
            { x: 11, y: 20, z: 30 },
            { x: 10, y: 21, z: 30 },
        ]);
    });

    test("merges every object when there is no <build> section", async () => {
        const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
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
</model>`;
        const file = await make3mfFile(modelXml);

        const mesh = await parse3mf(file);

        expect(mesh.vertices).toHaveLength(3);
        expect(mesh.triangles).toEqual([[0, 1, 2]]);
    });

    test("rejects a package missing 3D/3dmodel.model", async () => {
        const zip = new JSZip();
        zip.file("not-a-model.txt", "irrelevant");
        const blob = await zip.generateAsync({ type: "blob" });
        const file = new File([blob], "bad.3mf");

        await expect(parse3mf(file)).rejects.toThrow(/3dmodel\.model/);
    });
});
