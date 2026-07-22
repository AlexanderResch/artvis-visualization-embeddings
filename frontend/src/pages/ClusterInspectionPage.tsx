import {
    Alert,
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Typography,
} from "@mui/material";

import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    useNavigate,
    useParams,
} from "react-router";

import {
    fetchClusterInspection,
} from "../api/clustersApi";

import {
    fetchEmbeddings2D,
    fetchEmbeddings3D,
} from "../api/embeddingsApi";

import {
    ClusterArtistsTable,
} from "../components/cluster/ClusterArtistsTable";

import {
    ClusterDetailsPanel,
} from "../components/cluster/ClusterDetailsPanel";

import {
    ClusterFilterSidebar,
} from "../components/cluster/ClusterFilterSidebar";

import {
    EmbeddingCanvas2D,
} from "../components/map/EmbeddingCanvas2D";

import {
    Panel,
} from "../components/ui/Panel";

import {
    useExplorer,
    type YearRange,
} from "../context/ExplorerContext";

import type {
    ClusterArtist,
    ClusterInspection,
} from "../types/cluster";

import type {
    ArtistEmbedding2D,
    ArtistEmbedding3D,
    ViewMode,
} from "../types/embedding";

import {
    clusterColor,
} from "../visualization/colors";


const EmbeddingCanvas3D =
    lazy(
        () =>
            import(
                "../components/map/EmbeddingCanvas3D"
                ),
    );


export function ClusterInspectionPage() {
    const navigate =
        useNavigate();

    const params =
        useParams();

    const explorer =
        useExplorer();

    const clusterId =
        Number(
            params.clusterId,
        );

    const [
        inspection,
        setInspection,
    ] = useState<
        ClusterInspection | null
    >(null);

    const [
        embeddings2D,
        setEmbeddings2D,
    ] = useState<
        ArtistEmbedding2D[]
    >([]);

    const [
        embeddings3D,
        setEmbeddings3D,
    ] = useState<
        ArtistEmbedding3D[] | null
    >(null);

    const [
        viewMode,
        setViewMode,
    ] = useState<ViewMode>("2d");

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        loading3D,
        setLoading3D,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState<string | null>(
        null,
    );

    const [
        map3DError,
        setMap3DError,
    ] = useState<string | null>(
        null,
    );

    const [
        minimumMembership,
        setMinimumMembership,
    ] = useState(0);

    const [
        yearRange,
        setYearRange,
    ] = useState<
        YearRange | null
    >(null);

    const [
        selectedGroupIds,
        setSelectedGroupIds,
    ] = useState<string[]>([]);

    const [
        showSurroundingClusters,
        setShowSurroundingClusters,
    ] = useState(true);

    useEffect(
        () => {
            if (
                !Number.isInteger(clusterId)
                || clusterId < 0
            ) {
                setError(
                    "Invalid cluster ID",
                );
                setLoading(false);
                return;
            }

            const controller =
                new AbortController();

            setLoading(true);
            setError(null);

            Promise.all([
                fetchClusterInspection(
                    clusterId,
                    controller.signal,
                ),

                fetchEmbeddings2D(
                    controller.signal,
                ),
            ])
                .then(
                    ([
                         inspectionResponse,
                         embeddingResponse,
                     ]) => {
                        setInspection(
                            inspectionResponse,
                        );

                        setEmbeddings2D(
                            embeddingResponse,
                        );

                        explorer
                            .setSelectedClusterId(
                                clusterId,
                            );
                    },
                )
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to load cluster inspection",
                            );
                        }
                    },
                )
                .finally(
                    () => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setLoading(false);
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [clusterId],
    );

    useEffect(
        () => {
            if (
                viewMode !== "3d"
                || embeddings3D !== null
            ) {
                return;
            }

            const controller =
                new AbortController();

            setLoading3D(true);
            setMap3DError(null);

            fetchEmbeddings3D(
                controller.signal,
            )
                .then(
                    (response) => {
                        setEmbeddings3D(
                            response,
                        );
                    },
                )
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setMap3DError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to load 3D embedding map",
                            );
                        }
                    },
                )
                .finally(
                    () => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setLoading3D(false);
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [
            embeddings3D,
            viewMode,
        ],
    );

    const acceptsArtist =
        useCallback(
            (artist: ClusterArtist) => {
                if (
                    artist.membership_probability
                    < minimumMembership
                ) {
                    return false;
                }

                if (yearRange) {
                    if (
                        artist.birth_year === null
                        || artist.birth_year
                        < yearRange[0]
                        || artist.birth_year
                        > yearRange[1]
                    ) {
                        return false;
                    }
                }

                if (
                    selectedGroupIds.length
                    && !artist.groups.some(
                        (group) =>
                            selectedGroupIds.includes(
                                group.id,
                            ),
                    )
                ) {
                    return false;
                }

                return true;
            },
            [
                minimumMembership,
                selectedGroupIds,
                yearRange,
            ],
        );

    const filteredArtists =
        useMemo(
            () =>
                inspection
                    ? inspection.artists.filter(
                        acceptsArtist,
                    )
                    : [],
            [
                acceptsArtist,
                inspection,
            ],
        );

    const filteredArtistIds =
        useMemo(
            () =>
                new Set(
                    filteredArtists.map(
                        (artist) =>
                            artist.id,
                    ),
                ),
            [filteredArtists],
        );

    const selectedClusterBoundary2D =
        useMemo(
            () =>
                embeddings2D.filter(
                    (artist) =>
                        artist.cluster
                        === clusterId,
                ),
            [
                clusterId,
                embeddings2D,
            ],
        );

    const selectedClusterBoundary3D =
        useMemo(
            () =>
                embeddings3D?.filter(
                    (artist) =>
                        artist.cluster
                        === clusterId,
                )
                ?? [],
            [
                clusterId,
                embeddings3D,
            ],
        );

    const mapData2D =
        useMemo(
            () => {
                if (!inspection) {
                    return [];
                }

                if (!showSurroundingClusters) {
                    return embeddings2D.filter(
                        (artist) =>
                            artist.cluster
                            === clusterId
                            && filteredArtistIds.has(
                                artist.id,
                            ),
                    );
                }

                return embeddings2D.filter(
                    (artist) =>
                        artist.cluster
                        !== clusterId
                        || filteredArtistIds.has(
                            artist.id,
                        ),
                );
            },
            [
                clusterId,
                embeddings2D,
                filteredArtistIds,
                inspection,
                showSurroundingClusters,
            ],
        );

    const mapData3D =
        useMemo(
            () => {
                if (
                    !inspection
                    || !embeddings3D
                ) {
                    return [];
                }

                if (!showSurroundingClusters) {
                    return embeddings3D.filter(
                        (artist) =>
                            artist.cluster
                            === clusterId
                            && filteredArtistIds.has(
                                artist.id,
                            ),
                    );
                }

                return embeddings3D.filter(
                    (artist) =>
                        artist.cluster
                        !== clusterId
                        || filteredArtistIds.has(
                            artist.id,
                        ),
                );
            },
            [
                clusterId,
                embeddings3D,
                filteredArtistIds,
                inspection,
                showSurroundingClusters,
            ],
        );

    function selectClusterArtist(
        artist: {
            id: string;
            cluster: number;
        },
    ) {
        if (
            artist.cluster
            !== clusterId
        ) {
            return;
        }

        explorer
            .setSelectedArtistId(
                artist.id,
            );
    }

    function resetFilters() {
        setMinimumMembership(0);
        setYearRange(null);
        setSelectedGroupIds([]);
        setShowSurroundingClusters(true);
        explorer
            .setSelectedArtistId(null);
    }

    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "grid",
                    placeItems: "center",
                }}
            >
                <Box
                    sx={{
                        textAlign: "center",
                    }}
                >
                    <CircularProgress />

                    <Typography
                        sx={{
                            mt: 2,
                        }}
                    >
                        Loading cluster inspection…
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (error || !inspection) {
        return (
            <Box
                sx={{
                    p: 3,
                }}
            >
                <Button
                    onClick={
                        () =>
                            navigate("/")
                    }
                    sx={{
                        mb: 2,
                    }}
                >
                    Back to dashboard
                </Button>

                <Alert severity="error">
                    {error
                        ?? "Cluster inspection is unavailable"}
                </Alert>
            </Box>
        );
    }

    const color =
        clusterColor(clusterId);

    const visiblePointCount =
        viewMode === "2d"
            ? mapData2D.length
            : mapData3D.length;

    return (
        <Box
            className="cluster-inspection-page"
        >
            <Box
                component="header"
                className="cluster-inspection-header"
            >
                <Box>
                    <Button
                        size="small"
                        onClick={
                            () =>
                                navigate("/")
                        }
                        sx={{
                            mb: 0.5,
                        }}
                    >
                        Back to dashboard
                    </Button>

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <Box
                            aria-hidden
                            sx={{
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                backgroundColor: color,
                            }}
                        />

                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 800,
                            }}
                        >
                            Cluster {clusterId} inspection
                        </Typography>
                    </Box>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                    >
                        Inspect cluster membership,
                        descriptive graph evidence and
                        alignment with ArtVis groups.
                    </Typography>
                </Box>
            </Box>

            <Box
                className="cluster-inspection-grid"
            >
                <Panel
                    className="cluster-filters-panel"
                >
                    <ClusterFilterSidebar
                        inspection={inspection}
                        visibleArtistCount={
                            filteredArtists.length
                        }
                        minimumMembership={
                            minimumMembership
                        }
                        onMinimumMembershipChange={
                            setMinimumMembership
                        }
                        yearRange={yearRange}
                        onYearRangeChange={
                            setYearRange
                        }
                        selectedGroupIds={
                            selectedGroupIds
                        }
                        onSelectedGroupIdsChange={
                            setSelectedGroupIds
                        }
                        showSurroundingClusters={
                            showSurroundingClusters
                        }
                        onShowSurroundingClustersChange={
                            setShowSurroundingClusters
                        }
                        onReset={resetFilters}
                    />
                </Panel>

                <Panel
                    className="cluster-map-panel"
                >
                    <Box
                        sx={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <Box
                            sx={{
                                px: 1.5,
                                py: 1,
                                borderBottom:
                                    "1px solid",
                                borderColor: "divider",
                                display: "flex",
                                justifyContent:
                                    "space-between",
                                alignItems: "center",
                                gap: 1.5,
                            }}
                        >
                            <Box
                                sx={{
                                    minWidth: 0,
                                }}
                            >
                                <Typography
                                    variant="subtitle1"
                                    sx={{
                                        fontWeight: 700,
                                    }}
                                >
                                    Embedding map
                                </Typography>

                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {viewMode === "2d"
                                        ? (
                                            "The selected cluster is outlined by a stable boundary calculated in 2D UMAP space."
                                        )
                                        : (
                                            "The selected cluster is enclosed by its current projected 3D silhouette. Rotate the view to inspect its spatial structure."
                                        )}
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    flexShrink: 0,
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {
                                        visiblePointCount
                                            .toLocaleString()
                                    }
                                    {" points"}
                                </Typography>

                                <ButtonGroup
                                    size="small"
                                    aria-label={
                                        "Cluster embedding map dimension"
                                    }
                                >
                                    <Button
                                        variant={
                                            viewMode === "2d"
                                                ? "contained"
                                                : "outlined"
                                        }
                                        onClick={() =>
                                            setViewMode("2d")
                                        }
                                    >
                                        2D
                                    </Button>

                                    <Button
                                        variant={
                                            viewMode === "3d"
                                                ? "contained"
                                                : "outlined"
                                        }
                                        onClick={() =>
                                            setViewMode("3d")
                                        }
                                    >
                                        3D
                                    </Button>
                                </ButtonGroup>
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                position: "relative",
                            }}
                        >
                            {viewMode === "2d" ? (
                                <EmbeddingCanvas2D
                                    data={mapData2D}
                                    highlightBoundaryData={
                                        selectedClusterBoundary2D
                                    }
                                    highlightClusterId={
                                        clusterId
                                    }
                                    dimNonHighlighted={
                                        showSurroundingClusters
                                    }
                                    onArtistClick={
                                        selectClusterArtist
                                    }
                                />
                            ) : loading3D ? (
                                <Box
                                    sx={{
                                        height: "100%",
                                        display: "grid",
                                        placeItems: "center",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            textAlign: "center",
                                        }}
                                    >
                                        <CircularProgress />

                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{
                                                mt: 1.5,
                                            }}
                                        >
                                            Loading 3D embedding map…
                                        </Typography>
                                    </Box>
                                </Box>
                            ) : map3DError ? (
                                <Box
                                    sx={{
                                        p: 2,
                                    }}
                                >
                                    <Alert
                                        severity="error"
                                        action={
                                            <Button
                                                color="inherit"
                                                size="small"
                                                onClick={() =>
                                                    setViewMode("2d")
                                                }
                                            >
                                                Show 2D
                                            </Button>
                                        }
                                    >
                                        {map3DError}
                                    </Alert>
                                </Box>
                            ) : embeddings3D ? (
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
                                        data={mapData3D}
                                        highlightBoundaryData={
                                            selectedClusterBoundary3D
                                        }
                                        highlightClusterId={
                                            clusterId
                                        }
                                        dimNonHighlighted={
                                            showSurroundingClusters
                                        }
                                        onArtistClick={
                                            selectClusterArtist
                                        }
                                    />
                                </Suspense>
                            ) : null}
                        </Box>
                    </Box>
                </Panel>

                <Panel
                    className="cluster-details-panel"
                >
                    <ClusterDetailsPanel
                        inspection={inspection}
                        visibleArtistCount={
                            filteredArtists.length
                        }
                    />
                </Panel>

                <Panel
                    title={
                        `Artists in Cluster ${clusterId}`
                    }
                    className="cluster-artists-panel"
                >
                    <ClusterArtistsTable
                        artists={filteredArtists}
                    />
                </Panel>
            </Box>
        </Box>
    );
}
