import {
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Slider,
    Typography,
} from "@mui/material";

import {
    lazy,
    Suspense,
    useCallback,
    useMemo,
    useState,
} from "react";

import {
    useExplorer,
} from "../../context/ExplorerContext";

import type {
    ArtistEmbedding2D,
    ArtistEmbedding3D,
} from "../../types/embedding";

import type {
    VisibleClusterSummary,
} from "../../types/map";

import {
    clusterColor,
    NOISE_COLOR,
} from "../../visualization/colors";

import {
    EmbeddingCanvas2D,
} from "./EmbeddingCanvas2D";


const EmbeddingCanvas3D =
    lazy(
        () =>
            import(
                "./EmbeddingCanvas3D"
                ),
    );


const MAX_LEGEND_CLUSTERS = 8;


function summarizeData(
    data:
        ArtistEmbedding2D[]
        | ArtistEmbedding3D[],
): VisibleClusterSummary[] {
    const counts =
        new Map<number, number>();

    for (const artist of data) {
        counts.set(
            artist.cluster,
            (
                counts.get(artist.cluster)
                ?? 0
            ) + 1,
        );
    }

    return [...counts.entries()]
        .map(
            ([cluster, count]) => ({
                cluster,
                count,
                isNoise: cluster < 0,
            }),
        )
        .sort(
            (first, second) =>
                second.count
                - first.count
                || first.cluster
                - second.cluster,
        );
}


function uniqueValidClusterIds(
    values: Array<number | null | undefined>,
): number[] {
    const result: number[] = [];

    for (const value of values) {
        if (
            value === null
            || value === undefined
            || value < 0
            || result.includes(value)
        ) {
            continue;
        }

        result.push(value);
    }

    return result;
}


export function EmbeddingMap({
                                 data2D,
                                 data3D,
                                 loading3D,
                                 error3D = null,
                                 onRequest3D,
                                 highlightClusterId = null,
                                 highlightBoundaryData2D,
                                 highlightBoundaryData3D,
                                 dimNonHighlighted = false,
                                 comparisonArtistIds = null,
                                 dimNonCompared = false,
                                 focusData2D,
                                 focusData3D,
                                 onArtistClick,
                                 title = "Embedding cluster map",
                                 description,
                                 legendPriorityClusterIds = [],
                             }: {
    data2D: ArtistEmbedding2D[];
    data3D: ArtistEmbedding3D[] | null;
    loading3D: boolean;
    error3D?: string | null;
    onRequest3D: () => void;
    highlightClusterId?: number | null;
    highlightBoundaryData2D?: ArtistEmbedding2D[];
    highlightBoundaryData3D?: ArtistEmbedding3D[];
    dimNonHighlighted?: boolean;
    comparisonArtistIds?:
        [string, string] | null;
    dimNonCompared?: boolean;
    focusData2D?: ArtistEmbedding2D[];
    focusData3D?: ArtistEmbedding3D[];
    onArtistClick?: (
        artist:
            ArtistEmbedding2D
            | ArtistEmbedding3D,
    ) => void;
    title?: string;
    description?: string;
    legendPriorityClusterIds?: number[];
}) {
    const explorer =
        useExplorer();

    const [
        pointScale,
        setPointScale,
    ] = useState(1.0);

    const [
        fitRequestKey,
        setFitRequestKey,
    ] = useState(0);

    const [
        visibleClusterState,
        setVisibleClusterState,
    ] = useState<{
        mode: "2d" | "3d";
        items: VisibleClusterSummary[];
    }>({
        mode: "2d",
        items: [],
    });

    const visibleClusters =
        visibleClusterState.mode
        === explorer.viewMode
            ? visibleClusterState.items
            : [];

    const handleVisibleClustersChange =
        useCallback(
            (items: VisibleClusterSummary[]) =>
                setVisibleClusterState({
                    mode: explorer.viewMode,
                    items,
                }),
            [explorer.viewMode],
        );

    const visibleCount =
        explorer.viewMode === "2d"
            ? data2D.length
            : data3D?.length ?? 0;

    const activeFocusCount =
        explorer.viewMode === "2d"
            ? focusData2D?.length ?? 0
            : focusData3D?.length ?? 0;

    const defaultDescription =
        highlightClusterId !== null
            ? explorer.viewMode === "2d"
                ? "The selected cluster is outlined in the stable 2D UMAP projection."
                : "The selected cluster is outlined by its current projected 3D silhouette."
            : "Click an Artist point to inspect it. Use the map controls to adjust point size and focus.";

    const interactionHint =
        useMemo(
            () =>
                explorer.viewMode === "2d"
                    ? "Drag to pan · Wheel to zoom"
                    : "Drag to rotate · Shift + drag to pan · Wheel zooms at the cursor",
            [explorer.viewMode],
        );

    const fallbackClusters =
        useMemo(
            () =>
                summarizeData(
                    explorer.viewMode === "2d"
                        ? data2D
                        : data3D ?? [],
                ),
            [
                data2D,
                data3D,
                explorer.viewMode,
            ],
        );

    const activeClusterSummary =
        visibleClusters.length > 0
            ? visibleClusters
            : fallbackClusters;

    const priorityClusterIds =
        useMemo(
            () =>
                uniqueValidClusterIds([
                    highlightClusterId,
                    ...legendPriorityClusterIds,
                ]),
            [
                highlightClusterId,
                legendPriorityClusterIds,
            ],
        );

    const legend =
        useMemo(
            () => {
                const byCluster =
                    new Map<number, VisibleClusterSummary>();

                for (const item of fallbackClusters) {
                    byCluster.set(item.cluster, item);
                }

                for (const item of activeClusterSummary) {
                    byCluster.set(item.cluster, item);
                }

                const entries:
                    VisibleClusterSummary[] = [];

                for (const clusterId of priorityClusterIds) {
                    const item =
                        byCluster.get(clusterId);

                    if (item && !item.isNoise) {
                        entries.push(item);
                    }
                }

                for (const item of activeClusterSummary) {
                    if (
                        item.isNoise
                        || entries.some(
                            (entry) =>
                                entry.cluster
                                === item.cluster,
                        )
                    ) {
                        continue;
                    }

                    entries.push(item);

                    if (
                        entries.length
                        >= MAX_LEGEND_CLUSTERS
                    ) {
                        break;
                    }
                }

                const nonNoiseInView =
                    activeClusterSummary.filter(
                        (item) =>
                            !item.isNoise,
                    ).length;

                const representedInView =
                    entries.filter(
                        (entry) =>
                            activeClusterSummary.some(
                                (item) =>
                                    item.cluster
                                    === entry.cluster,
                            ),
                    ).length;

                return {
                    entries:
                        entries.slice(
                            0,
                            MAX_LEGEND_CLUSTERS,
                        ),
                    noise:
                        activeClusterSummary.find(
                            (item) =>
                                item.isNoise,
                        ) ?? null,
                    hiddenCount:
                        Math.max(
                            0,
                            nonNoiseInView
                            - representedInView,
                        ),
                };
            },
            [
                activeClusterSummary,
                fallbackClusters,
                priorityClusterIds,
            ],
        );

    return (
        <Box
            sx={{
                height: "100%",
                minHeight: 480,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                sx={{
                    px: 1.25,
                    py: 0.75,
                    display: "flex",
                    alignItems: {
                        xs: "stretch",
                        lg: "center",
                    },
                    justifyContent:
                        "space-between",
                    flexDirection: {
                        xs: "column",
                        lg: "row",
                    },
                    gap: 0.75,
                    borderBottom:
                        "1px solid",
                    borderColor:
                        "divider",
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700 }}
                    >
                        {title}
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                    >
                        {visibleCount.toLocaleString()}
                        {" visible Artists · "}
                        {description
                            ?? defaultDescription}
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mt: 0.1,
                        }}
                    >
                        {interactionHint}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 0.75,
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            width: 132,
                            px: 0.25,
                        }}
                    >
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                display: "block",
                                mb: -0.25,
                            }}
                        >
                            Point size multiplier
                        </Typography>

                        <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{
                                display: "block",
                                fontSize: "0.64rem",
                                lineHeight: 1.1,
                                mb: -0.2,
                            }}
                        >
                            Auto-adjusts with zoom
                        </Typography>

                        <Slider
                            size="small"
                            min={0.6}
                            max={1.5}
                            step={0.1}
                            value={pointScale}
                            onChange={(
                                _,
                                value,
                            ) =>
                                setPointScale(
                                    value as number,
                                )
                            }
                            aria-label="Embedding point size"
                        />
                    </Box>

                    <Button
                        size="small"
                        variant="outlined"
                        disabled={
                            activeFocusCount === 0
                        }
                        onClick={() =>
                            setFitRequestKey(
                                (current) =>
                                    current + 1,
                            )
                        }
                    >
                        Fit focus
                    </Button>

                    <ButtonGroup
                        size="small"
                        aria-label="Embedding map dimension"
                    >
                        <Button
                            variant={
                                explorer.viewMode
                                === "2d"
                                    ? "contained"
                                    : "outlined"
                            }
                            onClick={() =>
                                explorer.setViewMode(
                                    "2d",
                                )
                            }
                        >
                            2D
                        </Button>

                        <Button
                            variant={
                                explorer.viewMode
                                === "3d"
                                    ? "contained"
                                    : "outlined"
                            }
                            onClick={() => {
                                onRequest3D();
                                explorer.setViewMode(
                                    "3d",
                                );
                            }}
                        >
                            3D
                        </Button>
                    </ButtonGroup>
                </Box>
            </Box>

            {(legend.entries.length > 0
                || legend.noise) && (
                <Box
                    aria-label="Cluster color legend"
                    sx={{
                        px: 1.25,
                        py: 0.55,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.8,
                        overflowX: "auto",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        backgroundColor: "grey.50",
                        flexShrink: 0,
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                        }}
                    >
                        Clusters in view
                    </Typography>

                    {legend.entries.map(
                        (item) => {
                            const selected =
                                priorityClusterIds.includes(
                                    item.cluster,
                                );

                            return (
                                <Box
                                    key={item.cluster}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.45,
                                        px: 0.6,
                                        py: 0.25,
                                        borderRadius: 1,
                                        border: "1px solid",
                                        borderColor: selected
                                            ? clusterColor(
                                                item.cluster,
                                            )
                                            : "transparent",
                                        backgroundColor: selected
                                            ? "background.paper"
                                            : "transparent",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 9,
                                            height: 9,
                                            borderRadius: "50%",
                                            backgroundColor:
                                                clusterColor(
                                                    item.cluster,
                                                ),
                                            boxShadow:
                                                "0 0 0 1px rgba(17,24,39,0.16)",
                                        }}
                                    />

                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            fontWeight: selected
                                                ? 700
                                                : 500,
                                        }}
                                    >
                                        Cluster {item.cluster}
                                        {" · "}
                                        {item.count.toLocaleString()}
                                    </Typography>
                                </Box>
                            );
                        },
                    )}

                    {legend.noise && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.45,
                                px: 0.6,
                                py: 0.25,
                                whiteSpace: "nowrap",
                            }}
                        >
                            <Box
                                sx={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    backgroundColor:
                                        NOISE_COLOR,
                                }}
                            />

                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                Noise · {legend.noise.count.toLocaleString()}
                            </Typography>
                        </Box>
                    )}

                    {legend.hiddenCount > 0 && (
                        <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ whiteSpace: "nowrap" }}
                        >
                            +{legend.hiddenCount} more
                        </Typography>
                    )}
                </Box>
            )}

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    position: "relative",
                }}
            >
                {explorer.viewMode === "2d"
                    ? (
                        <EmbeddingCanvas2D
                            data={data2D}
                            highlightBoundaryData={
                                highlightBoundaryData2D
                            }
                            highlightClusterId={
                                highlightClusterId
                            }
                            dimNonHighlighted={
                                dimNonHighlighted
                            }
                            comparisonArtistIds={
                                comparisonArtistIds
                            }
                            dimNonCompared={
                                dimNonCompared
                            }
                            focusData={focusData2D}
                            fitRequestKey={fitRequestKey}
                            pointScale={pointScale}
                            onVisibleClustersChange={
                                handleVisibleClustersChange
                            }
                            onArtistClick={
                                onArtistClick
                                    ? (artist) =>
                                        onArtistClick(
                                            artist,
                                        )
                                    : undefined
                            }
                        />
                    )
                    : error3D
                        ? (
                            <Box sx={{ p: 1.5 }}>
                                <Typography
                                    color="error"
                                    variant="body2"
                                >
                                    {error3D}
                                </Typography>
                            </Box>
                        )
                        : loading3D
                        || !data3D
                            ? (
                                <Box
                                    sx={{
                                        height: "100%",
                                        display: "grid",
                                        placeItems: "center",
                                    }}
                                >
                                    <CircularProgress />
                                </Box>
                            )
                            : (
                                <Suspense
                                    fallback={
                                        <Box
                                            sx={{
                                                height: "100%",
                                                display: "grid",
                                                placeItems: "center",
                                            }}
                                        >
                                            <CircularProgress />
                                        </Box>
                                    }
                                >
                                    <EmbeddingCanvas3D
                                        data={data3D}
                                        highlightBoundaryData={
                                            highlightBoundaryData3D
                                        }
                                        highlightClusterId={
                                            highlightClusterId
                                        }
                                        dimNonHighlighted={
                                            dimNonHighlighted
                                        }
                                        comparisonArtistIds={
                                            comparisonArtistIds
                                        }
                                        dimNonCompared={
                                            dimNonCompared
                                        }
                                        focusData={focusData3D}
                                        fitRequestKey={fitRequestKey}
                                        pointScale={pointScale}
                                        onVisibleClustersChange={
                                            handleVisibleClustersChange
                                        }
                                        onArtistClick={
                                            onArtistClick
                                                ? (artist) =>
                                                    onArtistClick(
                                                        artist,
                                                    )
                                                : undefined
                                        }
                                    />
                                </Suspense>
                            )}
            </Box>
        </Box>
    );
}
