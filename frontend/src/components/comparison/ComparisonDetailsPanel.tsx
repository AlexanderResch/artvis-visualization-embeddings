import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Chip,
    LinearProgress,
    Typography,
} from "@mui/material";

import type {
    ReactNode,
} from "react";

import type {
    ArtistComparisonResponse,
    ComparisonArtist,
} from "../../types/comparison";

import {
    clusterColor,
    clusterTextColor,
} from "../../visualization/colors";


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
    count?: number;
    children: ReactNode;
    defaultExpanded?: boolean;
}) {
    return (
        <Accordion
            disableGutters
            defaultExpanded={defaultExpanded}
            sx={{
                mb: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "8px !important",
                boxShadow: "none",

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
                    backgroundColor:
                        "action.hover",

                    "&.Mui-expanded": {
                        minHeight: 48,
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
                        sx={{ fontWeight: 700 }}
                    >
                        {title}
                    </Typography>

                    {count !== undefined && (
                        <Chip
                            size="small"
                            variant="outlined"
                            label={count}
                            sx={{
                                backgroundColor:
                                    "background.paper",
                            }}
                        />
                    )}
                </Box>
            </AccordionSummary>

            <AccordionDetails>
                {children}
            </AccordionDetails>
        </Accordion>
    );
}


function ArtistSummary({
                           prefix,
                           artist,
                       }: {
    prefix: "A" | "B";
    artist: ComparisonArtist;
}) {
    return (
        <Box
            sx={{
                p: 1.25,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
            }}
        >
            <Typography
                variant="caption"
                color="text.secondary"
            >
                Artist {prefix}
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    fontWeight: 800,
                    mt: 0.25,
                }}
            >
                {artist.display_name}
            </Typography>

            <Chip
                size="small"
                label={
                    artist.is_noise
                        ? "Noise"
                        : `Cluster ${artist.cluster}`
                }
                sx={{
                    mt: 0.75,
                    color:
                        clusterTextColor(
                            artist.cluster,
                        ),
                    backgroundColor:
                        clusterColor(
                            artist.cluster,
                        ),
                    fontWeight: 700,
                }}
            />
        </Box>
    );
}


function CountRow({
                      label,
                      value,
                  }: {
    label: string;
    value: number | string;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent:
                    "space-between",
                gap: 1,
                py: 0.65,
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
                sx={{ fontWeight: 800 }}
            >
                {value}
            </Typography>
        </Box>
    );
}


export function ComparisonDetailsPanel({
                                           comparison,
                                       }: {
    comparison: ArtistComparisonResponse;
}) {
    const similarityPercent =
        Math.max(
            0,
            Math.min(
                100,
                comparison.embedding_similarity
                * 100,
            ),
        );

    const commonCount =
        comparison.common.groups.length
        + comparison.common.exhibitions.length
        + comparison.common.locations.length;

    const differentProperties =
        comparison.differences.filter(
            (difference) =>
                !difference.same,
        );

    return (
        <Box sx={{ p: 2 }}>
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 800,
                    mb: 1,
                }}
            >
                Artist comparison
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gap: 1,
                    mb: 2,
                }}
            >
                <ArtistSummary
                    prefix="A"
                    artist={comparison.artist_a}
                />

                <ArtistSummary
                    prefix="B"
                    artist={comparison.artist_b}
                />
            </Box>

            <Box
                sx={{
                    p: 1.5,
                    mb: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    backgroundColor:
                        "action.hover",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        justifyContent:
                            "space-between",
                        alignItems: "baseline",
                        gap: 1,
                        mb: 0.75,
                    }}
                >
                    <Typography
                        variant="body2"
                        color="text.secondary"
                    >
                        Embedding similarity
                    </Typography>

                    <Typography
                        variant="h5"
                        sx={{ fontWeight: 800 }}
                    >
                        {comparison.embedding_similarity.toFixed(3)}
                    </Typography>
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={similarityPercent}
                    sx={{
                        height: 9,
                        borderRadius: 999,

                        "& .MuiLinearProgress-bar": {
                            borderRadius: 999,
                        },
                    }}
                />

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: "block",
                        mt: 0.75,
                    }}
                >
                    Calculated in the high-dimensional Artist embedding, not from the visible 2D or 3D distance.
                </Typography>
            </Box>

            <DetailAccordion
                title="Commonalities"
                count={commonCount}
                defaultExpanded
            >
                <CountRow
                    label="Common ArtVis groups"
                    value={
                        comparison.common.groups.length
                    }
                />

                <CountRow
                    label="Common exhibitions"
                    value={
                        comparison.common.exhibitions.length
                    }
                />

                <CountRow
                    label="Common locations"
                    value={
                        comparison.common.locations.length
                    }
                />

                <CountRow
                    label="Shared computed cluster"
                    value={
                        comparison.same_cluster
                            ? "Yes"
                            : "No"
                    }
                />

                <CountRow
                    label="Direct CO_EXHIBITED relation"
                    value={
                        comparison.co_exhibited.direct_relationship
                            ? "Yes"
                            : "No"
                    }
                />

                <CountRow
                    label="Shared exhibitions count"
                    value={
                        comparison.co_exhibited.shared_exhibition_count
                    }
                />
            </DetailAccordion>

            <DetailAccordion
                title="Differences"
                count={differentProperties.length}
                defaultExpanded
            >
                {differentProperties.length === 0
                    ? (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            No differences were found for the compared summary properties.
                        </Typography>
                    )
                    : differentProperties.map(
                        (difference) => (
                            <Box
                                key={difference.label}
                                sx={{
                                    py: 0.9,
                                    borderBottom:
                                        "1px solid",
                                    borderColor:
                                        "divider",

                                    "&:last-of-type": {
                                        borderBottom: 0,
                                    },
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {difference.label}
                                </Typography>

                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "1fr 1fr",
                                        gap: 1,
                                        mt: 0.25,
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 700,
                                        }}
                                    >
                                        A: {difference.artist_a_value}
                                    </Typography>

                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 700,
                                        }}
                                    >
                                        B: {difference.artist_b_value}
                                    </Typography>
                                </Box>
                            </Box>
                        ),
                    )}
            </DetailAccordion>

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                    display: "block",
                    mt: 1.5,
                }}
            >
                {comparison.note}
            </Typography>
        </Box>
    );
}
