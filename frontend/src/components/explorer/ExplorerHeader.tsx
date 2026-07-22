import {
    Box,
    Breadcrumbs,
    Button,
    Chip,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import type {
    ClusterOption,
} from "../../types/dashboard";

import type {
    ArtistEmbedding2D,
} from "../../types/embedding";

import {
    clusterColor,
    clusterTextColor,
} from "../../visualization/colors";


export type ExplorerMode =
    | "overview"
    | "cluster"
    | "artist";


function artistLabel(
    artist: ArtistEmbedding2D | null,
): string {
    if (!artist) {
        return "Selected artist";
    }

    const displayName =
        typeof artist.display_name === "string"
            ? artist.display_name.trim()
            : "";

    return displayName
        || artist.entity
        || `Artist ${artist.id}`;
}


export function ExplorerHeader({
                                   mode,
                                   clusters,
                                   selectedClusterId,
                                   selectedArtist,
                                   onShowOverview,
                                   onShowCluster,
                                   onSelectCluster,
                               }: {
    mode: ExplorerMode;
    clusters: ClusterOption[];
    selectedClusterId: number | null;
    selectedArtist: ArtistEmbedding2D | null;
    onShowOverview: () => void;
    onShowCluster: () => void;
    onSelectCluster: (
        clusterId: number | null,
    ) => void;
}) {
    const validSelectedClusterId =
        selectedClusterId !== null
        && selectedClusterId >= 0
            ? selectedClusterId
            : null;

    return (
        <Box
            component="header"
            className="explorer-header"
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: {
                        xs: "stretch",
                        md: "center",
                    },
                    justifyContent:
                        "space-between",
                    flexDirection: {
                        xs: "column",
                        md: "row",
                    },
                    gap: 1.5,
                    px: 0.5,
                    py: 0.5,
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                    }}
                >
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 800,
                        }}
                    >
                        ArtVis Embedding Explorer
                    </Typography>

                    <Breadcrumbs
                        aria-label="Explorer context"
                        sx={{
                            mt: 0.25,
                        }}
                    >
                        <Button
                            size="small"
                            onClick={
                                onShowOverview
                            }
                            sx={{
                                minWidth: 0,
                                px: 0,
                                textTransform:
                                    "none",
                            }}
                        >
                            Overview
                        </Button>

                        {validSelectedClusterId !== null && (
                            <Button
                                size="small"
                                onClick={
                                    onShowCluster
                                }
                                sx={{
                                    minWidth: 0,
                                    px: 0,
                                    textTransform:
                                        "none",
                                }}
                            >
                                Cluster {validSelectedClusterId}
                            </Button>
                        )}

                        {mode === "artist" && (
                            <Typography
                                variant="body2"
                                color="text.primary"
                                noWrap
                                sx={{
                                    maxWidth: 320,
                                }}
                            >
                                {artistLabel(
                                    selectedArtist,
                                )}
                            </Typography>
                        )}
                    </Breadcrumbs>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mt: 0.25,
                        }}
                    >
                        {mode === "overview"
                            ? "Explore the complete Artist embedding space and select a cluster or Artist."
                            : mode === "cluster"
                                ? "Inspect the selected cluster without leaving the central exploration workspace."
                                : "Inspect one Artist while preserving the surrounding cluster and map context."}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 1,
                        flexShrink: 0,
                    }}
                >
                    {validSelectedClusterId !== null && (
                        <Chip
                            size="small"
                            label={
                                `Cluster ${validSelectedClusterId}`
                            }
                            sx={{
                                color:
                                    clusterTextColor(
                                        validSelectedClusterId,
                                    ),
                                backgroundColor:
                                    clusterColor(
                                        validSelectedClusterId,
                                    ),
                                fontWeight: 700,
                            }}
                        />
                    )}

                    <TextField
                        select
                        size="small"
                        label="Inspect cluster"
                        value={
                            validSelectedClusterId
                            ?? ""
                        }
                        onChange={
                            (event) => {
                                const value =
                                    event.target.value;

                                onSelectCluster(
                                    value === ""
                                        ? null
                                        : Number(value),
                                );
                            }
                        }
                        sx={{
                            minWidth: 190,
                        }}
                    >
                        <MenuItem value="">
                            Overview
                        </MenuItem>

                        {clusters
                            .filter(
                                (cluster) =>
                                    !cluster.is_noise,
                            )
                            .sort(
                                (first, second) =>
                                    first.cluster
                                    - second.cluster,
                            )
                            .map(
                                (cluster) => (
                                    <MenuItem
                                        key={
                                            cluster.cluster
                                        }
                                        value={
                                            cluster.cluster
                                        }
                                    >
                                        Cluster {cluster.cluster}
                                        {" · "}
                                        {cluster.artist_count.toLocaleString()}
                                        {" Artists"}
                                    </MenuItem>
                                ),
                            )}
                    </TextField>

                    {mode === "artist"
                        && validSelectedClusterId !== null && (
                            <Button
                                variant="outlined"
                                onClick={
                                    onShowCluster
                                }
                            >
                                Inspect Cluster {validSelectedClusterId}
                            </Button>
                        )}

                    {mode !== "overview" && (
                        <Button
                            variant="outlined"
                            onClick={
                                onShowOverview
                            }
                        >
                            Return to Overview
                        </Button>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
