// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { RibbonTabProfile } from "@chili3d/core";

export const DefaultRibbon: RibbonTabProfile[] = [
    {
        tabName: "ribbon.tab.draw",
        groups: [
            {
                groupName: "ribbon.group.workingPlane",
                items: ["sketch.pickPlane", "sketch.finish"],
            },
            {
                groupName: "ribbon.group.draw",
                items: [
                    {
                        type: "split",
                        items: ["create.line", "create.lineMidpoint"],
                    },
                    {
                        type: "split",
                        items: ["create.rect", "create.centerRect", "create.alignedRect"],
                    },
                    {
                        type: "split",
                        items: ["create.circle", "create.circle3Point", "create.ellipse"],
                    },
                    {
                        type: "split",
                        items: ["create.arc3point", "create.arcTTR", "create.arc", "create.ellipticalArc"],
                    },
                    {
                        type: "split",
                        items: ["create.regularPolygon", "create.circumscribedPolygon"],
                    },
                    "create.bezier",
                ],
            },
            {
                groupName: "ribbon.group.annotation",
                items: [
                    {
                        type: "split",
                        items: [
                            "create.dimensionAuto",
                            "create.dimensionLinear",
                            "create.dimensionRadius",
                            "create.dimensionDiameter",
                            "create.dimensionAngle",
                        ],
                    },
                ],
            },
            {
                groupName: "ribbon.group.modify",
                items: ["modify.move"],
            },
        ],
    },
    {
        tabName: "ribbon.tab.model",
        groups: [
            {
                groupName: "ribbon.group.draw",
                items: [
                    "create.line",
                    {
                        type: "split",
                        items: ["create.rect", "create.circle", "create.ellipse", "create.regularPolygon"],
                    },
                    {
                        type: "split",
                        items: ["create.arc", "create.arc2point", "create.arc3point", "create.arcTTR"],
                    },
                    {
                        type: "split",
                        items: [
                            "create.box",
                            "create.sphere",
                            "create.cylinder",
                            "create.cone",
                            "create.pyramid",
                        ],
                    },
                    "create.extrude",
                    ["create.loft", "create.sweep", "create.revol"],
                ],
                collapsedItems: [
                    "create.point",
                    "create.polygon",
                    "create.bezier",
                    "create.helix",
                    "create.pipe",
                ],
            },
            {
                groupName: "ribbon.group.modify",
                items: [
                    "modify.move",
                    ["modify.rotate", "modify.mirror", "modify.array"],
                    ["modify.trim", "modify.extend", "modify.shell"],
                    ["modify.split", "modify.sew", "modify.simplifyShape"],
                    ["modify.fillet", "modify.chamfer", "modify.explode"],
                    ["modify.deleteNode", "modify.removeShapes", "modify.removeFeature"],
                ],
                collapsedItems: [
                    "modify.break",
                    "modify.paintBucket",
                    "modify.brushAdd",
                    "modify.brushRemove",
                    "modify.brushClear",
                ],
            },
            {
                groupName: "ribbon.group.converter",
                items: [
                    "convert.toWire",
                    "convert.toCompound",
                    ["convert.toFace", "convert.toShell", "convert.toSolid"],
                ],
            },
            {
                groupName: "ribbon.group.boolean",
                items: [["boolean.common", "boolean.cut", "boolean.join"]],
            },
            {
                groupName: "ribbon.group.workingPlane",
                items: [
                    "workingPlane.toggleDynamic",
                    ["workingPlane.set", "workingPlane.alignToPlane", "workingPlane.fromSection"],
                ],
            },
            {
                groupName: "ribbon.group.tools",
                items: [
                    "convert.curveProjection",
                    "create.group",
                    ["create.section", "create.offset", "create.copyShape"],
                ],
                collapsedItems: ["modify.repairShape", "modify.checkShape"],
            },
            {
                groupName: "ribbon.group.measure",
                items: [["measure.length", "measure.angle", "measure.select"]],
            },
            {
                groupName: "ribbon.group.act",
                items: ["act.alignCamera"],
            },
            {
                groupName: "ribbon.group.importExport",
                items: ["file.import", "file.export"],
            },
        ],
    },
    {
        tabName: "ribbon.tab.manager",
        groups: [
            {
                groupName: "ribbon.group.other",
                items: ["test.performance"],
            },
        ],
    },
];
