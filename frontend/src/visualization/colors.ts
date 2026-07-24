export const NOISE_COLOR = "#6B7280";

export const CLUSTER_COLORS = [
    "#ED1D1D",
    "#1DED1D",
    "#0F8AB3",
    "#8022A0",
    "#B38A0F",
    "#5FF2F2",
    "#F25FF2",
    "#22A080",
    "#EDED1D",
    "#A02241",
    "#F25F83",
    "#7070E1",
    "#80A022",
    "#E18C70",

    "#2241A0",
    "#B3610F",
    "#70E1A8",
    "#70C4E1",
    "#E1C470",
    "#ED851D",
    "#A04122",
    "#B91DED",
    "#5FA8F2",
    "#0FB338",
    "#0FB3B3",
    "#D435AC",
    "#511DED",
    "#E1A870",
    "#ACD435",
    "#0F61B3",
    "#ED1D51",
    "#A870E1",
    "#1D85ED",
    "#B3B30F",
] as const;


function generatedClusterColor(
    cluster: number,
): string {
    const goldenAngle =
        137.50776405003785;

    const hue =
        (
            17
            + cluster * goldenAngle
        ) % 360;

    const saturation =
        cluster % 2 === 0
            ? 82
            : 68;

    const lightness =
        cluster % 3 === 0
            ? 38
            : cluster % 3 === 1
                ? 50
                : 62;

    return `hsl(${hue.toFixed(2)} ${saturation}% ${lightness}%)`;
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


type RgbColor = {
    red: number;
    green: number;
    blue: number;
};


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
        return "rgba(17, 24, 39, 0.40)";
    }

    return clusterTextColor(cluster)
    === "#111827"
        ? "rgba(17, 24, 39, 0.82)"
        : "rgba(255, 255, 255, 0.88)";
}