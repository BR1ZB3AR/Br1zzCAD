// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Binding, Config } from "@chili3d/core";
import { afterEach, describe, expect, test } from "@rstest/core";
import { ToggleConstructionMode } from "../../src/commands/sketchToggleConstructionMode";

describe("ToggleConstructionMode", () => {
    afterEach(() => {
        Config.instance.constructionMode = false;
    });

    test("should have command metadata with a toggle binding", () => {
        const data = (ToggleConstructionMode as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("sketch.toggleConstructionMode");
        expect(data.icon).toBe("icon-constructionLine");
        expect(data.toggle).toBeInstanceOf(Binding);
    });

    test("execute should flip Config.instance.constructionMode on", async () => {
        expect(Config.instance.constructionMode).toBe(false);

        await new ToggleConstructionMode().execute({} as any);

        expect(Config.instance.constructionMode).toBe(true);
    });

    test("execute should flip Config.instance.constructionMode back off", async () => {
        Config.instance.constructionMode = true;

        await new ToggleConstructionMode().execute({} as any);

        expect(Config.instance.constructionMode).toBe(false);
    });
});
