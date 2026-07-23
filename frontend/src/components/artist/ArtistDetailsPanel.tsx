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

import {
    scaleLinear,
} from "d3";

import type {
    ReactNode,
} from "react";

import type {
    ClusterArtist,
} from "../../types/cluster";

import type {
    SimilarArtist,
} from "../../types/dashboard";

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
                             defaultExpanded = false,
                         }: {
    title: string;
    count: number;
    children: ReactNode;
    defaultExpanded?: boolean;
}) {
    return (
        <Accordion
            disableGutters
            defaultExpanded={
                defaultExpanded
            }
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
    artist:
        ArtistEmbedding2D
        | SimilarArtist,
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
    similarArtists?: SimilarArtist[];
    totalSimilarArtistCount?: number;
    similarityThreshold?: number;
    onSelectSimilarArtist?: (
        artistId: string,
    ) => void;
    showSimilarArtists?: boolean;
};


export function ArtistDetailsPanel({
                                       artist,
                                       clusterArtist,
                                       similarArtists = [],
                                       totalSimilarArtistCount = 0,
                                       similarityThreshold = 0.7,
                                       onSelectSimilarArtist,
                                       showSimilarArtists = true,
                                   }: ArtistDetailsPanelProps) {
    const hasCluster =
        artist.cluster >= 0;

    const color =
        clusterColor(
            artist.cluster,
        );

    const barScale =
        scaleLinear()
            .domain([
                similarityThreshold,
                1,
            ])
            .range([
                6,
                100,
            ])
            .clamp(true);

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
                                        key={location.id}
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

            {showSimilarArtists && (
                <>
                    <Divider
                        sx={{
                            my: 2,
                        }}
                    />

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent:
                                "space-between",
                            gap: 1,
                            mb: 1,
                        }}
                    >
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 800,
                            }}
                        >
                            Similar Artists
                        </Typography>

                        <Typography
                            variant="caption"
                            color="text.secondary"
                        >
                            {similarArtists.length}
                            {" of "}
                            {totalSimilarArtistCount}
                        </Typography>
                    </Box>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mb: 1,
                        }}
                    >
                        Similarity is computed in the high-dimensional embedding space. Select a row to inspect another Artist.
                    </Typography>

                    {similarArtists.length === 0
                        ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                No similar Artist satisfies the current threshold.
                            </Typography>
                        )
                        : (
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 0.75,
                                }}
                            >
                                {similarArtists.map(
                                    (similarArtist) => (
                                        <Box
                                            key={similarArtist.id}
                                            component="button"
                                            type="button"
                                            onClick={() =>
                                                onSelectSimilarArtist?.(
                                                    similarArtist.id,
                                                )
                                            }
                                            sx={{
                                                appearance: "none",
                                                width: "100%",
                                                p: 0.9,
                                                border: "1px solid",
                                                borderColor: "divider",
                                                borderRadius: 1.5,
                                                backgroundColor:
                                                    "background.paper",
                                                textAlign: "left",
                                                cursor: "pointer",

                                                "&:hover": {
                                                    backgroundColor:
                                                        "action.hover",
                                                },

                                                "&:focus-visible": {
                                                    outline:
                                                        "2px solid",
                                                    outlineColor:
                                                        "primary.main",
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 1,
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 700,
                                                        minWidth: 0,
                                                    }}
                                                    noWrap
                                                >
                                                    {displayName(
                                                        similarArtist,
                                                    )}
                                                </Typography>

                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 800,
                                                        fontVariantNumeric:
                                                            "tabular-nums",
                                                    }}
                                                >
                                                    {similarArtist.similarity.toFixed(3)}
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={{
                                                    mt: 0.6,
                                                    height: 7,
                                                    borderRadius: 999,
                                                    overflow: "hidden",
                                                    backgroundColor:
                                                        "action.hover",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width:
                                                            `${barScale(similarArtist.similarity)}%`,
                                                        height: "100%",
                                                        borderRadius: 999,
                                                        backgroundColor:
                                                            clusterColor(
                                                                similarArtist.cluster,
                                                            ),
                                                    }}
                                                />
                                            </Box>

                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{
                                                    display: "block",
                                                    mt: 0.45,
                                                }}
                                                noWrap
                                            >
                                                {similarArtist.is_noise
                                                    ? "Noise"
                                                    : `Cluster ${similarArtist.cluster}`}
                                                {" · "}
                                                {similarArtist.common_groups.length}
                                                {" shared groups · "}
                                                {similarArtist.common_exhibitions.length}
                                                {" shared exhibitions"}
                                            </Typography>
                                        </Box>
                                    ),
                                )}
                            </Box>
                        )}

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mt: 1.5,
                        }}
                    >
                        The visible 2D or 3D distance is a projection and can differ from the reported embedding similarity.
                    </Typography>
                </>
            )}
        </Box>
    );
}
