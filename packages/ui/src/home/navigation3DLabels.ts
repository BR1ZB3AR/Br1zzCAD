// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { Navigation3DType } from "@chili3d/core";
import { navigationKeyMapFor } from "@chili3d/core";

/** Product-facing label for a navigation scheme (enum value stays Chili3d). */
export function navigation3DDisplayName(scheme: Navigation3DType): string {
    return scheme === "Chili3d" ? "Br1zzCAD" : scheme;
}

/** Tooltip / title text listing pan and rotate chords for a scheme. */
export function navigation3DChordTitle(scheme: Navigation3DType): string {
    const { pan, rotate } = navigationKeyMapFor(scheme);
    return `Pan: ${pan} · Rotate: ${rotate}`;
}
