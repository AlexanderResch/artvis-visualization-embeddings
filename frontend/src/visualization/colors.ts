export const NOISE_COLOR = "#9CA3AF";


type RgbColor = {
    red: number;
    green: number;
    blue: number;
};


function clampChannel(
    value: number,
): number {
    return Math.max(
        0,
        Math.min(
            255,
            Math.round(value),
        ),
    );
}


function rgbToHex({
                      red,
                      green,
                      blue,
                  }: RgbColor): string {
    return `#${[
        red,
        green,
        blue,
    ]
        .map(
            (channel) =>
                clampChannel(channel)
                    .toString(16)
                    .padStart(2, "0"),
        )
        .join("")}`.toUpperCase();
}


function hslToHex(
    hue: number,
    saturation: number,
    lightness: number,
): string {
    const normalizedHue =
        (
            (
                hue % 360
            ) + 360
        ) % 360 / 360;

    const normalizedSaturation =
        Math.max(
            0,
            Math.min(
                1,
                saturation / 100,
            ),
        );

    const normalizedLightness =
        Math.max(
            0,
            Math.min(
                1,
                lightness / 100,
            ),
        );

    if (normalizedSaturation === 0) {
        const gray =
            normalizedLightness * 255;

        return rgbToHex({
            red: gray,
            green: gray,
            blue: gray,
        });
    }

    const hueToRgb = (
        first: number,
        second: number,
        offset: number,
    ) => {
        let adjusted = offset;

        if (adjusted < 0) {
            adjusted += 1;
        }

        if (adjusted > 1) {
            adjusted -= 1;
        }

        if (adjusted < 1 / 6) {
            return first
                + (
                    second - first
                )
                * 6
                * adjusted;
        }

        if (adjusted < 1 / 2) {
            return second;
        }

        if (adjusted < 2 / 3) {
            return first
                + (
                    second - first
                )
                * (
                    2 / 3 - adjusted
                )
                * 6;
        }

        return first;
    };

    const second =
        normalizedLightness < 0.5
            ? normalizedLightness
            * (
                1 + normalizedSaturation
            )
            : normalizedLightness
            + normalizedSaturation
            - normalizedLightness
            * normalizedSaturation;

    const first =
        2 * normalizedLightness
        - second;

    return rgbToHex({
        red:
            hueToRgb(
                first,
                second,
                normalizedHue + 1 / 3,
            ) * 255,
        green:
            hueToRgb(
                first,
                second,
                normalizedHue,
            ) * 255,
        blue:
            hueToRgb(
                first,
                second,
                normalizedHue - 1 / 3,
            ) * 255,
    });
}


function reverseBits(
    value: number,
    bitCount: number,
): number {
    let source = value;
    let result = 0;

    for (
        let bitIndex = 0;
        bitIndex < bitCount;
        bitIndex += 1
    ) {
        result =
            (
                result << 1
            )
            | (
                source & 1
            );

        source >>= 1;
    }

    return result;
}


function createDistinctClusterPalette(
    colorCount: number,
): readonly string[] {
    const bitCount =
        Math.max(
            1,
            Math.ceil(
                Math.log2(colorCount),
            ),
        );

    const hueSlots =
        2 ** bitCount;

    const saturationLevels = [
        78,
        68,
        84,
        72,
    ];

    const lightnessLevels = [
        45,
        55,
        39,
        60,
    ];

    return Array.from(
        {
            length: colorCount,
        },
        (_, clusterIndex) => {
            const reorderedIndex =
                reverseBits(
                    clusterIndex,
                    bitCount,
                );

            const hue =
                8
                + reorderedIndex
                * 360
                / hueSlots;

            const styleIndex =
                Math.floor(
                    clusterIndex / 16,
                ) % saturationLevels.length;

            return hslToHex(
                hue,
                saturationLevels[styleIndex],
                lightnessLevels[styleIndex],
            );
        },
    );
}


/**
 * A deterministic palette with 64 unique colors. The bit-reversed hue order
 * keeps neighboring cluster IDs far apart in hue, which is more useful than
 * assigning colors sequentially around the color wheel.
 */
export const CLUSTER_COLORS =
    createDistinctClusterPalette(64);


function generatedClusterColor(
    cluster: number,
): string {
    const goldenAngle =
        137.50776405003785;

    const hue =
        (
            11
            + cluster * goldenAngle
        ) % 360;

    const saturation =
        cluster % 2 === 0
            ? 78
            : 68;

    const lightness =
        cluster % 3 === 0
            ? 42
            : cluster % 3 === 1
                ? 52
                : 59;

    return hslToHex(
        hue,
        saturation,
        lightness,
    );
}


export function clusterColor(
    cluster: number,
): string {
    if (
        !Number.isFinite(cluster)
        || cluster < 0
    ) {
        return NOISE_COLOR;
    }

    const clusterIndex =
        Math.trunc(cluster);

    return (
        CLUSTER_COLORS[
            clusterIndex
            ]
        ?? generatedClusterColor(
            clusterIndex,
        )
    );
}


function hexToRgb(
    color: string,
): RgbColor | null {
    const match =
        /^#([0-9a-f]{6})$/i.exec(
            color,
        );

    if (!match) {
        return null;
    }

    const hex =
        match[1];

    return {
        red: Number.parseInt(
            hex.slice(0, 2),
            16,
        ),
        green: Number.parseInt(
            hex.slice(2, 4),
            16,
        ),
        blue: Number.parseInt(
            hex.slice(4, 6),
            16,
        ),
    };
}


function relativeLuminance(
    color: string,
): number | null {
    const rgb =
        hexToRgb(
            color,
        );

    if (!rgb) {
        return null;
    }

    const channels = [
        rgb.red,
        rgb.green,
        rgb.blue,
    ].map(
        (channel) => {
            const normalized =
                channel / 255;

            return normalized <= 0.04045
                ? normalized / 12.92
                : Math.pow(
                    (
                        normalized
                        + 0.055
                    ) / 1.055,
                    2.4,
                );
        },
    );

    return (
        channels[0] * 0.2126
        + channels[1] * 0.7152
        + channels[2] * 0.0722
    );
}


export function clusterTextColor(
    cluster: number,
): "#111827" | "#FFFFFF" {
    const luminance =
        relativeLuminance(
            clusterColor(
                cluster,
            ),
        );

    if (luminance === null) {
        return "#FFFFFF";
    }

    return luminance > 0.42
        ? "#111827"
        : "#FFFFFF";
}


export function clusterPointOutlineColor(
    cluster: number,
): string {
    if (
        !Number.isFinite(cluster)
        || cluster < 0
    ) {
        return "rgba(55, 65, 81, 0.26)";
    }

    return clusterTextColor(cluster)
    === "#111827"
        ? "rgba(17, 24, 39, 0.78)"
        : "rgba(255, 255, 255, 0.90)";
}
