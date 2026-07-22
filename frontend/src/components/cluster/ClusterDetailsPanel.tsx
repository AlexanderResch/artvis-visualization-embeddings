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

import {
    useExplorer,
} from "../../context/ExplorerContext";

import type {
    ClusterInspection,
} from "../../types/cluster";

import {
    clusterColor,
} from "../../visualization/colors";

import {
    ScentedMetricList,
} from "./ScentedMetricList";


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
                justifyContent: "space-between",
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


function yearRange(
    minimum: number | null,
    maximum: number | null,
): string {
    if (
        minimum === null
        || maximum === null
    ) {
        return "Unknown";
    }

    return `${minimum}–${maximum}`;
}


function ExpandIndicator() {
    return (
        <Box
            component="span"
            sx={{
                color: "text.secondary",
                fontSize: 20,
                lineHeight: 1,
                transition: "transform 160ms ease",
            }}
        >
            ▾
        </Box>
    );
}


function ExplanationAccordion({
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

                backgroundColor:
                    "background.paper",

                overflow: "hidden",

                "&::before": {
                    display: "none",
                },

                "&.Mui-expanded": {
                    margin: 0,
                    mb: 1,
                },

                "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded":
                    {
                        transform:
                            "rotate(180deg)",
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

                    "& .MuiAccordionSummary-content":
                        {
                            my: 1,
                            minWidth: 0,
                        },

                    "& .MuiAccordionSummary-content.Mui-expanded":
                        {
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
                            minWidth: 0,
                        }}
                    >
                        {title}
                    </Typography>

                    <Chip
                        size="small"
                        variant="outlined"
                        label={
                            count.toLocaleString()
                        }
                        sx={{
                            flexShrink: 0,

                            backgroundColor:
                                "background.paper",
                        }}
                    />
                </Box>
            </AccordionSummary>

            <AccordionDetails
                sx={{
                    px: 1.25,
                    pt: 1.25,
                    pb: 1.25,
                }}
            >
                {children}
            </AccordionDetails>
        </Accordion>
    );
}


function getRepresentativeArtistLabel(
    displayName:
        string | null | undefined,
    artistId: string,
): string {
    const normalizedName =
        typeof displayName === "string"
            ? displayName.trim()
            : "";

    if (normalizedName) {
        return normalizedName;
    }

    return `Artist ${artistId}`;
}


export function ClusterDetailsPanel({
                                        inspection,
                                        visibleArtistCount,
                                    }: {
    inspection: ClusterInspection;
    visibleArtistCount: number;
}) {
    const explorer =
        useExplorer();

    const color =
        clusterColor(
            inspection.cluster,
        );

    const groupCoverage =
        inspection.artist_count > 0
            ? (
                inspection.statistics
                    .artists_with_recorded_group
                / inspection.artist_count
            )
            * 100
            : 0;

    return (
        <Box
            sx={{
                p: 2,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                        "space-between",
                    gap: 1,
                    mb: 1,
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 800,
                    }}
                >
                    Cluster {inspection.cluster}
                </Typography>

                <Chip
                    label="Selected"
                    size="small"
                    sx={{
                        color: "white",

                        backgroundColor:
                        color,
                    }}
                />
            </Box>


            <StatRow
                label="Artists in cluster"
                value={
                    inspection
                        .artist_count
                        .toLocaleString()
                }
            />

            <StatRow
                label="Visible after filters"
                value={
                    visibleArtistCount
                        .toLocaleString()
                }
            />

            <StatRow
                label="Mean membership"
                value={
                    inspection.statistics
                        .mean_membership_probability
                        .toFixed(3)
                }
            />

            <StatRow
                label="Mean centroid similarity"
                value={
                    inspection.statistics
                        .mean_similarity_to_centroid
                        .toFixed(3)
                }
            />

            <StatRow
                label="Mean outlier score"
                value={
                    inspection.statistics
                        .mean_outlier_score
                        .toFixed(3)
                }
            />

            <StatRow
                label="Birth-year range"
                value={
                    yearRange(
                        inspection.statistics
                            .birth_year.minimum,

                        inspection.statistics
                            .birth_year.maximum,
                    )
                }
            />


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

                        gap: 1,
                        mb: 0.5,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Artists with recorded
                        ArtVis group
                    </Typography>

                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {
                            inspection.statistics
                                .artists_with_recorded_group
                                .toLocaleString()
                        }

                        {" · "}

                        {
                            groupCoverage
                                .toFixed(1)
                        }
                        %
                    </Typography>
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={
                        Math.min(
                            100,
                            Math.max(
                                0,
                                groupCoverage,
                            ),
                        )
                    }
                    sx={{
                        height: 8,
                        borderRadius: 999,

                        backgroundColor:
                            "action.hover",

                        "& .MuiLinearProgress-bar":
                            {
                                backgroundColor:
                                color,

                                borderRadius:
                                    999,
                            },
                    }}
                />
            </Box>


            <Box
                sx={{
                    mb: 1.5,
                }}
            >
                <Typography
                    variant="subtitle1"
                    sx={{
                        fontWeight: 800,
                    }}
                    gutterBottom
                >
                    Cluster explanation
                </Typography>

                <Typography
                    variant="body2"
                    color="text.secondary"
                >
                    Shared graph context
                    provides descriptive
                    evidence for why Artists
                    appear together in the
                    embedding space.
                </Typography>
            </Box>


            <ExplanationAccordion
                title="Top ArtVis groups"
                count={
                    inspection.explanation
                        .top_artvis_groups
                        .length
                }
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: "block",
                        mb: 1,
                    }}
                >
                    ArtVis groups with the
                    highest number of Artists
                    from this computed cluster.
                </Typography>

                <ScentedMetricList
                    items={
                        inspection.explanation
                            .top_artvis_groups
                    }
                    color={
                        color
                    }
                    maximumItems={
                        8
                    }
                    emptyText={
                        "No group memberships recorded"
                    }
                />
            </ExplanationAccordion>


            <ExplanationAccordion
                title="Top shared exhibitions"
                count={
                    inspection.explanation
                        .top_exhibitions
                        .length
                }
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: "block",
                        mb: 1,
                    }}
                >
                    Exhibitions connected to
                    the largest number of
                    Artists in this cluster.
                </Typography>

                <ScentedMetricList
                    items={
                        inspection.explanation
                            .top_exhibitions
                    }
                    color={
                        "secondary.main"
                    }
                    maximumItems={
                        8
                    }
                    emptyText={
                        "No shared exhibitions found"
                    }
                />
            </ExplanationAccordion>


            <ExplanationAccordion
                title="Top locations"
                count={
                    inspection.explanation
                        .top_locations
                        .length
                }
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: "block",
                        mb: 1,
                    }}
                >
                    Locations connected through
                    exhibitions of Artists in
                    this cluster.
                </Typography>

                <ScentedMetricList
                    items={
                        inspection.explanation
                            .top_locations
                    }
                    color={
                        "success.main"
                    }
                    maximumItems={
                        8
                    }
                    emptyText={
                        "No locations found"
                    }
                />
            </ExplanationAccordion>


            <ExplanationAccordion
                title="ArtVis group composition"
                count={
                    inspection
                        .group_composition
                        .length
                }
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: "block",
                        mb: 1,
                    }}
                >
                    Artists may belong to
                    multiple ArtVis groups.
                    Percentages can therefore
                    add up to more than
                    100 percent.
                </Typography>

                <Box
                    sx={{
                        maxHeight: 360,
                        overflowY: "auto",
                        pr: 0.5,
                    }}
                >
                    <ScentedMetricList
                        items={
                            inspection
                                .group_composition
                        }
                        color={
                            color
                        }
                        emptyText={
                            "No group memberships recorded"
                        }
                    />
                </Box>
            </ExplanationAccordion>


            <ExplanationAccordion
                title="Representative Artists"
                count={
                    inspection.explanation
                        .representative_artists
                        .length
                }
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: "block",
                        mb: 1,
                    }}
                >
                    Artists nearest to the
                    cluster centroid in the
                    original embedding space.
                </Typography>

                {
                    inspection.explanation
                        .representative_artists
                        .length === 0
                        ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                            >
                                No representative
                                Artists available.
                            </Typography>
                        )
                        : (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.75,
                                }}
                            >
                                {
                                    inspection
                                        .explanation
                                        .representative_artists
                                        .map(
                                            (artist) => {
                                                const selected =
                                                    explorer
                                                        .selectedArtistId
                                                    === artist.id;

                                                return (
                                                    <Chip
                                                        key={
                                                            artist.id
                                                        }
                                                        label={
                                                            getRepresentativeArtistLabel(
                                                                artist
                                                                    .display_name,

                                                                artist.id,
                                                            )
                                                        }
                                                        size="small"
                                                        variant={
                                                            selected
                                                                ? "filled"
                                                                : "outlined"
                                                        }
                                                        sx={
                                                            selected
                                                                ? {
                                                                    color:
                                                                        "white",

                                                                    backgroundColor:
                                                                    color,
                                                                }
                                                                : undefined
                                                        }
                                                        onClick={() => {
                                                            explorer
                                                                .setSelectedArtistId(
                                                                    artist.id,
                                                                );
                                                        }}
                                                    />
                                                );
                                            },
                                        )
                                }
                            </Box>
                        )
                }
            </ExplanationAccordion>


            <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                    display: "block",
                    mt: 1.5,
                }}
            >
                {
                    inspection
                        .explanation
                        .note
                }
            </Typography>
        </Box>
    );
}