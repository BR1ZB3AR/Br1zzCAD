// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Config, Navigation3DTypes } from "@chili3d/core";
import { type HTMLProps, option, select } from "@chili3d/element";
import { navigation3DChordTitle, navigation3DDisplayName } from "./navigation3DLabels";

export const Navigation3DSelector = (props: HTMLProps<HTMLElement>) => {
    const nav3DTypes: HTMLOptionElement[] = [];
    Navigation3DTypes.forEach((nav3DType) => {
        nav3DTypes.push(
            option({
                selected: nav3DType === Config.instance.navigation3D,
                textContent: navigation3DDisplayName(nav3DType),
                title: navigation3DChordTitle(nav3DType),
                value: nav3DType,
            }),
        );
    });
    return select(
        {
            title: "3D navigation mouse scheme",
            onchange: (e) => {
                const value = (e.target as HTMLSelectElement).value;
                const scheme = Navigation3DTypes.find((type) => type === value);
                if (scheme) {
                    Config.instance.navigation3D = scheme;
                }
            },
            ...props,
        },
        ...nav3DTypes,
    );
};
