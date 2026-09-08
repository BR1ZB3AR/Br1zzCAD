// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

/**
 * Estimates the triangle count of an STL file without fully parsing it -
 * cheap enough to run before attempting the real import.
 *
 * Binary STL stores the triangle count directly (a uint32 at byte offset 80),
 * but a binary file's 80-byte header can itself start with the text "solid"
 * (a legal, if confusing, choice some writers make), so a "solid" prefix
 * alone doesn't tell binary and ASCII apart. The reliable check: a binary
 * file's declared count must exactly account for the rest of the file's
 * bytes (80-byte header + 4-byte count + 50 bytes per triangle). If that
 * arithmetic doesn't hold, it's read as ASCII instead, counting "facet
 * normal" occurrences (one per triangle).
 */
export function estimateStlTriangleCount(content: Uint8Array): number | undefined {
    if (content.byteLength >= 84) {
        const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
        const declaredCount = view.getUint32(80, true);
        const expectedBinarySize = 84 + declaredCount * 50;
        if (expectedBinarySize === content.byteLength) {
            return declaredCount;
        }
    }

    const text = new TextDecoder().decode(content);
    const matches = text.match(/facet\s+normal/g);
    return matches?.length;
}
