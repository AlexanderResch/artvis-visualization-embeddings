import {
    Box,
    Breadcrumbs,
    Button,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import {
    useState,
} from "react";

import type {
    ClusterOption,
} from "../../types/dashboard";

import type {
    ArtistEmbedding2D,
} from "../../types/embedding";

import {
    ExplorerHelpDialog,
} from "./ExplorerHelpDialog";

import artvisMark from "../../assets/artvis-mark.svg";


export type ExplorerMode =
    | "overview"
    | "cluster"
    | "artist"
    | "compare"
    | "cluster-compare";


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
                                   onStartClusterComparison,
                                   onCancelComparison,
                                   onSelectCluster,
                                   onResetAll,
                               }: {
    mode: ExplorerMode;
    clusters: ClusterOption[];
    selectedClusterId: number | null;
    selectedArtist: ArtistEmbedding2D | null;
    comparisonArtist: ArtistEmbedding2D | null;
    comparisonClusterId: number | null;
    comparisonSelectionActive: boolean;
    onShowOverview: () => void;
    onShowCluster: () => void;
    onInspectArtist: () => void;
    onInspectComparisonArtist: () => void;
    onStartComparison: () => void;
    onStartClusterComparison: () => void;
    onCancelComparison: () => void;
    onSelectCluster: (
        clusterId: number | null,
    ) => void;
    onResetAll: () => void;
}) {
    const [
        helpOpen,
        setHelpOpen,
    ] = useState(false);
    const validSelectedClusterId =
        selectedClusterId !== null
        && selectedClusterId >= 0
            ? selectedClusterId
            : null;

    const hasSelectedArtist =
        selectedArtist !== null;

    const description =
        comparisonSelectionActive
            ? "Select a second Artist on the map or search for Artist B in the sidebar."
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
                        : mode === "cluster-compare"
                            ? "Compare two computed clusters through descriptive statistics and graph context."
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
                    gap: 1,
                    px: 0.25,
                    py: 0.25,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.15,
                        }}
                    >
                        <Box
                            component="img"
                            src={artvisMark}
                            alt=""
                            aria-hidden="true"
                            sx={{
                                width: 46,
                                height: 46,
                                flexShrink: 0,
                            }}
                        />

                        <Box sx={{ minWidth: 0 }}>
                            <Typography
                                variant="h5"
                                sx={{
                                    fontWeight: 800,
                                    lineHeight: 1.05,
                                    color: "#203747",
                                }}
                            >
                                ArtVis
                            </Typography>

                            <Typography
                                variant="caption"
                                sx={{
                                    display: "block",
                                    color: "text.secondary",
                                    fontWeight: 700,
                                    letterSpacing: "0.11em",
                                    lineHeight: 1.15,
                                }}
                            >
                                EMBEDDING EXPLORER
                            </Typography>
                        </Box>
                    </Box>

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

                        {mode !== "overview" && (
                            <Typography
                                variant="body2"
                                color="text.primary"
                                noWrap
                            >
                                {mode === "cluster"
                                    ? "Cluster inspection"
                                    : mode === "artist"
                                        ? "Artist inspection"
                                        : mode === "compare"
                                            ? "Artist comparison"
                                            : "Cluster comparison"}
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
                    {mode !== "compare" && mode !== "cluster-compare" && (
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
                        && mode !== "compare"
                        && mode !== "cluster-compare" && (
                            <Button
                                variant="outlined"
                                onClick={onShowCluster}
                            >
                                Inspect Cluster {validSelectedClusterId}
                            </Button>
                        )}

                    {hasSelectedArtist
                        && mode !== "artist"
                        && mode !== "compare"
                        && mode !== "cluster-compare" && (
                            <Button
                                variant="outlined"
                                onClick={onInspectArtist}
                            >
                                Inspect Artist
                            </Button>
                        )}

                    {validSelectedClusterId !== null
                        && mode !== "compare"
                        && mode !== "cluster-compare" && (
                            <Button
                                variant="outlined"
                                onClick={onStartClusterComparison}
                            >
                                Compare clusters
                            </Button>
                        )}

                    {hasSelectedArtist
                        && mode !== "compare"
                        && mode !== "cluster-compare"
                        && !comparisonSelectionActive && (
                            <Button
                                variant="outlined"
                                onClick={onStartComparison}
                            >
                                Compare Artists
                            </Button>
                        )}

                    {comparisonSelectionActive && (
                        <Button
                            variant="outlined"
                            onClick={onCancelComparison}
                        >
                            Cancel Compare
                        </Button>
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

                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                            setHelpOpen(true)
                        }
                        aria-label="Open Explorer help"
                    >
                        HELP ?
                    </Button>

                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onResetAll}
                    >
                        Reset all
                    </Button>

                    {mode !== "overview" && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={onShowOverview}
                        >
                            Return to Overview
                        </Button>
                    )}
                </Box>
            </Box>

            <ExplorerHelpDialog
                open={helpOpen}
                onClose={() =>
                    setHelpOpen(false)
                }
            />
        </Box>
    );
}
