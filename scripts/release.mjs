// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execAsync } from "./common.mjs";

/**
 * @typedef {{
 *   name: string
 *   version: string
 *   documentVersion?: string
 *   dependencies?: { [dependenciesPackageName: string]: string }
 *   peerDependencies?: { [peerDependenciesPackageName: string]: string }
 * }} Package
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Calendar versions use Asia/Kuala_Lumpur (UTC+8). Format: YYYY.MM.DD.HHMM */
const VERSION_TZ = "Asia/Kuala_Lumpur";

/**
 * @returns {string} Calendar version without leading v, e.g. 2026.09.04.2302
 */
export function calendarVersionNow(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: VERSION_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}.${get("month")}.${get("day")}.${get("hour")}${get("minute")}`;
}

/**
 * Display / git-tag form with leading v.
 * @param {string} version
 */
export function displayVersion(version) {
    return version.startsWith("v") ? version : `v${version}`;
}

const packages = fs.readdirSync(path.resolve(__dirname, "../packages")).filter((p) => {
    const pkgRoot = path.resolve(__dirname, "../packages", p);
    if (fs.statSync(pkgRoot).isDirectory()) {
        const pkg = JSON.parse(fs.readFileSync(path.resolve(pkgRoot, "package.json"), "utf-8"));
        return !pkg.private;
    }
    return false;
});

/**
 * @param {string} version bare YYYY.MM.DD.HHMM
 */
function updateVersions(version) {
    updatePackage(path.resolve(__dirname, ".."), version, true);
    packages.forEach((p) => {
        updatePackage(getPkgRoot(p), version, false);
    });
    console.log(
        `Updated all packages to version ${version} (display ${displayVersion(version)}, TZ ${VERSION_TZ})`,
    );
}

/**
 * @param {string} pkg
 */
function getPkgRoot(pkg) {
    return path.resolve(__dirname, `../packages/${pkg}`);
}

/**
 * @param {string} pkgRoot
 * @param {string} version
 * @param {boolean} isRoot
 */
function updatePackage(pkgRoot, version, isRoot) {
    const pkgPath = path.resolve(pkgRoot, "package.json");
    /** @type {Package} */
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    pkg.version = version;
    if (isRoot) {
        pkg.documentVersion = version;
    }
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/**
 * @param {string} version bare or with v
 */
async function tag(version) {
    const bare = version.replace(/^v/, "");
    const tagName = displayVersion(bare);
    await execAsync(`git add -A`);
    await execAsync(`git commit -m '🐎 ci: release ${tagName}'`);
    await execAsync(`git tag ${tagName}`);
    await execAsync(`git push origin refs/tags/${tagName}`);
    await execAsync(`git push`);
}

async function main() {
    // Non-interactive by default. Pass --confirm for y/n prompt.
    // Optional argv: bare or v-prefixed YYYY.MM.DD.HHMM override.
    const args = process.argv.slice(2).filter((a) => a !== "--confirm" && a !== "--yes" && a !== "-y");
    const needsConfirm = process.argv.includes("--confirm");
    const bare = (args[0] ? args[0] : calendarVersionNow()).replace(/^v/, "");

    if (!/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/.test(bare)) {
        console.error(`Invalid calendar version '${bare}'. Expected YYYY.MM.DD.HHMM (TZ ${VERSION_TZ}).`);
        process.exit(1);
    }

    const shown = displayVersion(bare);
    console.log(`Releasing ${shown} (package ${bare}, TZ ${VERSION_TZ}).`);

    const run = async () => {
        updateVersions(bare);
        await tag(bare);
        console.log(`Released ${shown}`);
        process.exit(0);
    };

    if (!needsConfirm) {
        await run();
        return;
    }

    console.log("Confirm?<y/n>");
    process.stdin.on("data", async (data) => {
        if (data.toString().trim() === "y") {
            await run();
        } else {
            console.log("Aborting...");
            process.exit(1);
        }
    });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
    await main();
}
