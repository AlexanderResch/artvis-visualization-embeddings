import {
    Box,
    Typography
} from "@mui/material";

import type {
    ArtistEmbeddingBase
} from "../../types/embedding";


export type CanvasTooltipState = {
    left: number;
    top: number;
    artist: ArtistEmbeddingBase;
};


export function CanvasTooltip({
                                  tooltip
                              }: {
    tooltip: CanvasTooltipState | null;
}) {
    if (!tooltip) {
        return null;
    }

    const artist = tooltip.artist;

    return (
        <Box
            role="tooltip"
            sx={{
                position: "absolute",
                left: tooltip.left,
                top: tooltip.top,
                transform: "translate(12px, 12px)",
                pointerEvents: "none",
                zIndex: 4,
                px: 1.25,
                py: 0.9,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                backgroundColor:
                    "rgba(255,255,255,0.96)",
                boxShadow: 3,
                maxWidth: 250
            }}
        >
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 700
                }}
                noWrap
            >
                {artist.display_name}
            </Typography>

            <Typography
                variant="caption"
                sx={{
                    display: "block"
                }}
                color="text.secondary"
            >
                Birth: {artist.birth_year ?? "unknown"}
                {" · "}
                Death: {artist.death_year ?? "unknown"}
            </Typography>

            <Typography
                variant="caption"
                sx={{
                    display: "block"
                }}
                color="text.secondary"
            >
                {artist.is_noise
                    ? "Noise"
                    : `Cluster ${artist.cluster}`}

                {" · "}

                Membership{" "}
                {artist.membership_probability.toFixed(3)}
            </Typography>

            <Typography
                variant="caption"
                sx={{
                    display: "block"
                }}
                color="text.secondary"
            >
                Outlier score{" "}
                {artist.outlier_score.toFixed(3)}
            </Typography>
        </Box>
    );
}