import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Chip,
    Divider,
    LinearProgress,
    Typography,
} from "@mui/material";

import type {
    ReactNode,
} from "react";

import type {
    ClusterArtist,
} from "../../types/cluster";

import type {
    ArtistEmbedding2D,
} from "../../types/embedding";

import {
    clusterColor,
    clusterTextColor,
} from "../../visualization/colors";


function StatRow({
                     label,
                     value,
                 }: {
    label: string;
    value: string;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent:
                    "space-between",
                gap: 2,
                py: 0.7,
            }}
        >
            <Typography
                variant="body2"
                color="text.secondary"
            >
                {label}
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    fontWeight: 700,
                    textAlign: "right",
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}


function ExpandIndicator() {
    return (
        <Box
            component="span"
            sx={{
                color: "text.secondary",
                fontSize: 20,
                lineHeight: 1,
            }}
        >
            ▾
        </Box>
    );
}


function DetailAccordion({
                             title,
                             count,
                             children,
                         }: {
    title: string;
    count: number;
    children: ReactNode;
}) {
    return (
        <Accordion
            disableGutters
            sx={{
                mb: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius:
                    "8px !important",
                boxShadow: "none",
                overflow: "hidden",
                "&::before": {
                    display: "none",
                },
                "&.Mui-expanded": {
                    margin: 0,
                    mb: 1,
                },
            }}
        >
            <AccordionSummary
                expandIcon={
                    <ExpandIndicator />
                }
                sx={{
                    minHeight: 48,
                    px: 1.25,
                    backgroundColor:
                        "action.hover",
                    "&.Mui-expanded": {
                        minHeight: 48,
                    },
                    "& .MuiAccordionSummary-content": {
                        my: 1,
                    },
                    "& .MuiAccordionSummary-content.Mui-expanded": {
                        my: 1,
                    },
                }}
            >
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent:
                            "space-between",
                        gap: 1,
                        pr: 0.5,
                    }}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        {title}
                    </Typography>

                    <Chip
                        size="small"
                        variant="outlined"
                        label={count}
                        sx={{
                            backgroundColor:
                                "background.paper",
                        }}
                    />
                </Box>
            </AccordionSummary>

            <AccordionDetails
                sx={{
                    px: 1.25,
                    py: 1.25,
                }}
            >
                {children}
            </AccordionDetails>
        </Accordion>
    );
}


function displayName(
    artist: ArtistEmbedding2D,
): string {
    const name =
        typeof artist.display_name === "string"
            ? artist.display_name.trim()
            : "";

    return name
        || artist.entity
        || `Artist ${artist.id}`;
}


function lifeYears(
    artist: ArtistEmbedding2D,
): string {
    return `${artist.birth_year ?? "?"}–${artist.death_year ?? "?"}`;
}


type ArtistDetailsPanelProps = {
    artist: ArtistEmbedding2D;
    clusterArtist: ClusterArtist | null;
    onShowCluster: () => void;
    onShowOverview: () => void;
};


export function ArtistDetailsPanel({
                                       artist,
                                       clusterArtist,
                                   }: ArtistDetailsPanelProps) {
    const hasCluster =
        artist.cluster >= 0;

    const color =
        clusterColor(
            artist.cluster,
        );

    return (
        <Box
            sx={{
                p: 2,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems:
                        "flex-start",
                    justifyContent:
                        "space-between",
                    gap: 1,
                    mb: 1,
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 800,
                        }}
                    >
                        {displayName(artist)}
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        ID: {artist.id}
                    </Typography>
                </Box>

                <Chip
                    size="small"
                    label={
                        hasCluster
                            ? `Cluster ${artist.cluster}`
                            : "Noise"
                    }
                    sx={{
                        color:
                            clusterTextColor(
                                artist.cluster,
                            ),
                        backgroundColor:
                        color,
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                />
            </Box>

            <StatRow
                label="Life years"
                value={lifeYears(artist)}
            />

            <StatRow
                label="Nationality"
                value={
                    artist.nationality
                    ?? "Unknown"
                }
            />

            <StatRow
                label="Gender"
                value={
                    artist.gender
                    ?? "Unknown"
                }
            />

            <StatRow
                label="Membership probability"
                value={
                    artist
                        .membership_probability
                        .toFixed(3)
                }
            />

            <StatRow
                label="Outlier score"
                value={
                    artist
                        .outlier_score
                        .toFixed(3)
                }
            />

            {clusterArtist && (
                <StatRow
                    label="Similarity to cluster centroid"
                    value={
                        clusterArtist
                            .similarity_to_centroid
                            .toFixed(3)
                    }
                />
            )}

            <Box
                sx={{
                    mt: 1.5,
                    mb: 2,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        justifyContent:
                            "space-between",
                        mb: 0.5,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Cluster membership
                    </Typography>

                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        {(artist.membership_probability * 100).toFixed(1)}%
                    </Typography>
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={
                        Math.max(
                            0,
                            Math.min(
                                100,
                                artist.membership_probability
                                * 100,
                            ),
                        )
                    }
                    sx={{
                        height: 8,
                        borderRadius: 999,
                        "& .MuiLinearProgress-bar": {
                            backgroundColor:
                            color,
                            borderRadius: 999,
                        },
                    }}
                />
            </Box>

            <Divider
                sx={{
                    my: 2,
                }}
            />

            <Typography
                variant="subtitle1"
                sx={{
                    fontWeight: 800,
                    mb: 1,
                }}
            >
                Artist context
            </Typography>

            <DetailAccordion
                title="ArtVis groups"
                count={
                    clusterArtist?.groups.length
                    ?? 0
                }
            >
                {clusterArtist
                && clusterArtist.groups.length > 0
                    ? (
                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 0.75,
                            }}
                        >
                            {clusterArtist.groups.map(
                                (group) => (
                                    <Chip
                                        key={group.id}
                                        size="small"
                                        variant="outlined"
                                        label={group.name}
                                    />
                                ),
                            )}
                        </Box>
                    )
                    : (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            No recorded ArtVis group memberships.
                        </Typography>
                    )}
            </DetailAccordion>

            <DetailAccordion
                title="Exhibition locations"
                count={
                    clusterArtist?.locations.length
                    ?? 0
                }
            >
                {clusterArtist
                && clusterArtist.locations.length > 0
                    ? (
                        <Box
                            sx={{
                                display: "grid",
                                gap: 0.75,
                            }}
                        >
                            {clusterArtist.locations.map(
                                (location) => (
                                    <Box
                                        key={
                                            location.id
                                        }
                                        sx={{
                                            display: "flex",
                                            justifyContent:
                                                "space-between",
                                            gap: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                        >
                                            {location.name}
                                        </Typography>

                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {location.exhibition_count.toLocaleString()}
                                            {" exhibitions"}
                                        </Typography>
                                    </Box>
                                ),
                            )}
                        </Box>
                    )
                    : (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            No recorded exhibition locations.
                        </Typography>
                    )}
            </DetailAccordion>

            <StatRow
                label="Recorded exhibitions"
                value={
                    clusterArtist
                        ? clusterArtist.exhibition_count.toLocaleString()
                        : "Unknown"
                }
            />

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                    display: "block",
                    mt: 1.5,
                }}
            >
                Similarity and cluster membership are derived from the high-dimensional embedding. The visible 2D or 3D distance is only a projection.
            </Typography>
        </Box>
    );
}
