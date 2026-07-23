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
    | "artist"
    | "compare";


function artistLabel(
    artist: ArtistEmbedding2D | null,
): string {
    if (!artist) {
        return "Selected Artist";
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
                                   comparisonArtist,
                                   comparisonSelectionActive,
                                   onShowOverview,
                                   onShowCluster,
                                   onInspectArtist,
                                   onInspectComparisonArtist,
                                   onStartComparison,
                                   onCancelComparison,
                                   onSelectCluster,
                               }: {
    mode: ExplorerMode;
    clusters: ClusterOption[];
    selectedClusterId: number | null;
    selectedArtist: ArtistEmbedding2D | null;
    comparisonArtist: ArtistEmbedding2D | null;
    comparisonSelectionActive: boolean;
    onShowOverview: () => void;
    onShowCluster: () => void;
    onInspectArtist: () => void;
    onInspectComparisonArtist: () => void;
    onStartComparison: () => void;
    onCancelComparison: () => void;
    onSelectCluster: (
        clusterId: number | null,
    ) => void;
}) {
    const validSelectedClusterId =
        selectedClusterId !== null
        && selectedClusterId >= 0
            ? selectedClusterId
            : null;

    const hasSelectedArtist =
        selectedArtist !== null;

    const description =
        comparisonSelectionActive
            ? "Select a second Artist on the embedding map to start the comparison."
            : mode === "overview"
                ? hasSelectedArtist
                    ? "An Artist is selected. Inspect the Artist, inspect its cluster, or compare it with a second Artist."
                    : "Explore the complete Artist embedding space and select a cluster or Artist."
                : mode === "cluster"
                    ? hasSelectedArtist
                        ? "Inspect the cluster, inspect the selected Artist, or compare it with a second Artist."
                        : "Inspect the selected cluster without leaving the central exploration workspace."
                    : mode === "artist"
                        ? "Inspect one Artist while preserving the surrounding cluster and embedding-map context."
                        : "Compare two Artists through their embedding similarity and shared graph context.";

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
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        variant="h5"
                        sx={{ fontWeight: 800 }}
                    >
                        ArtVis Embedding Explorer
                    </Typography>

                    <Breadcrumbs
                        aria-label="Explorer context"
                        sx={{ mt: 0.25 }}
                    >
                        <Button
                            size="small"
                            onClick={onShowOverview}
                            sx={{
                                minWidth: 0,
                                px: 0,
                                textTransform: "none",
                            }}
                        >
                            Overview
                        </Button>

                        {mode !== "overview"
                            && mode !== "compare"
                            && validSelectedClusterId !== null && (
                                <Button
                                    size="small"
                                    onClick={onShowCluster}
                                    sx={{
                                        minWidth: 0,
                                        px: 0,
                                        textTransform: "none",
                                    }}
                                >
                                    Cluster {validSelectedClusterId}
                                </Button>
                            )}

                        {mode === "artist"
                            && selectedArtist && (
                                <Typography
                                    variant="body2"
                                    color="text.primary"
                                    noWrap
                                    sx={{ maxWidth: 320 }}
                                >
                                    {artistLabel(selectedArtist)}
                                </Typography>
                            )}

                        {mode === "compare" && (
                            <Typography
                                variant="body2"
                                color="text.primary"
                                noWrap
                                sx={{ maxWidth: 420 }}
                            >
                                {artistLabel(selectedArtist)}
                                {" ↔ "}
                                {artistLabel(comparisonArtist)}
                            </Typography>
                        )}
                    </Breadcrumbs>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.25 }}
                    >
                        {description}
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
                    {hasSelectedArtist
                        && mode !== "artist"
                        && mode !== "compare" && (
                            <Chip
                                size="small"
                                variant="outlined"
                                label={
                                    artistLabel(
                                        selectedArtist,
                                    )
                                }
                                sx={{
                                    maxWidth: 220,
                                    fontWeight: 700,
                                }}
                            />
                        )}

                    {mode === "compare"
                        && selectedArtist && (
                            <Chip
                                size="small"
                                variant="outlined"
                                label={
                                    `A · ${artistLabel(selectedArtist)}`
                                }
                                sx={{
                                    maxWidth: 220,
                                    fontWeight: 700,
                                }}
                            />
                        )}

                    {mode === "compare"
                        && comparisonArtist && (
                            <Chip
                                size="small"
                                variant="outlined"
                                label={
                                    `B · ${artistLabel(comparisonArtist)}`
                                }
                                sx={{
                                    maxWidth: 220,
                                    fontWeight: 700,
                                }}
                            />
                        )}

                    {validSelectedClusterId !== null
                        && mode !== "compare" && (
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

                    {mode !== "compare" && (
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
                            sx={{ minWidth: 190 }}
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
                                            key={cluster.cluster}
                                            value={cluster.cluster}
                                        >
                                            Cluster {cluster.cluster}
                                            {" · "}
                                            {cluster.artist_count.toLocaleString()}
                                            {" Artists"}
                                        </MenuItem>
                                    ),
                                )}
                        </TextField>
                    )}

                    {hasSelectedArtist
                        && validSelectedClusterId !== null
                        && mode !== "cluster"
                        && mode !== "compare" && (
                            <Button
                                variant="outlined"
                                onClick={onShowCluster}
                            >
                                Inspect Cluster {validSelectedClusterId}
                            </Button>
                        )}

                    {hasSelectedArtist
                        && mode !== "artist"
                        && mode !== "compare" && (
                            <Button
                                variant="outlined"
                                onClick={onInspectArtist}
                            >
                                Inspect Artist
                            </Button>
                        )}

                    {hasSelectedArtist
                        && mode !== "compare"
                        && !comparisonSelectionActive && (
                            <Button
                                variant="outlined"
                                onClick={onStartComparison}
                            >
                                Compare
                            </Button>
                        )}

                    {comparisonSelectionActive && (
                        <>
                            <Chip
                                size="small"
                                color="primary"
                                label="Select Artist B"
                            />

                            <Button
                                variant="outlined"
                                onClick={onCancelComparison}
                            >
                                Cancel Compare
                            </Button>
                        </>
                    )}

                    {mode === "compare"
                        && selectedArtist && (
                            <Button
                                variant="outlined"
                                onClick={onInspectArtist}
                            >
                                Inspect Artist A
                            </Button>
                        )}

                    {mode === "compare"
                        && comparisonArtist && (
                            <Button
                                variant="outlined"
                                onClick={
                                    onInspectComparisonArtist
                                }
                            >
                                Inspect Artist B
                            </Button>
                        )}

                    {mode !== "overview" && (
                        <Button
                            variant="outlined"
                            onClick={onShowOverview}
                        >
                            Return to Overview
                        </Button>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
