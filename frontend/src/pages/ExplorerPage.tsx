import {
    Alert,
    Box,
    CircularProgress,
    Typography,
} from "@mui/material";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    useSearchParams,
} from "react-router";

import {
    fetchClusterInspection,
} from "../api/clustersApi";

import {
    fetchDashboardOptions,
    fetchFilteredArtistIds,
} from "../api/dashboardApi";

import {
    fetchEmbeddings2D,
    fetchEmbeddings3D,
} from "../api/embeddingsApi";

import {
    ArtistDetailsPanel,
} from "../components/artist/ArtistDetailsPanel";

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
    OverviewPanel,
} from "../components/dashboard/OverviewPanel";

import {
    SimilarArtistsTable,
} from "../components/dashboard/SimilarArtistsTable";

import {
    ExplorerHeader,
    type ExplorerMode,
} from "../components/explorer/ExplorerHeader";

import {
    FilterSidebar,
} from "../components/filters/FilterSidebar";

import {
    EmbeddingMap,
} from "../components/map/EmbeddingMap";

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
    DashboardOptions,
} from "../types/dashboard";

import type {
    ArtistEmbedding2D,
    ArtistEmbedding3D,
} from "../types/embedding";


function getExplorerMode(
    selectedClusterId: number | null,
    selectedArtistId: string | null,
): ExplorerMode {
    if (selectedArtistId !== null) {
        return "artist";
    }

    if (
        selectedClusterId !== null
        && selectedClusterId >= 0
    ) {
        return "cluster";
    }

    return "overview";
}


function artistName(
    artist: ArtistEmbedding2D | null,
): string | null {
    if (!artist) {
        return null;
    }

    const displayName =
        typeof artist.display_name === "string"
            ? artist.display_name.trim()
            : "";

    return displayName
        || artist.entity
        || `Artist ${artist.id}`;
}


export function ExplorerPage() {
    const explorer =
        useExplorer();

    const [
        searchParams,
        setSearchParams,
    ] = useSearchParams();

    const initialSelectionAppliedRef =
        useRef(false);

    const [
        data2D,
        setData2D,
    ] = useState<ArtistEmbedding2D[]>([]);

    const [
        data3D,
        setData3D,
    ] = useState<ArtistEmbedding3D[] | null>(
        null,
    );

    const [
        options,
        setOptions,
    ] = useState<DashboardOptions | null>(
        null,
    );

    const [
        allowedArtistIds,
        setAllowedArtistIds,
    ] = useState<Set<string> | null>(
        null,
    );

    const [
        inspection,
        setInspection,
    ] = useState<ClusterInspection | null>(
        null,
    );

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        loading3D,
        setLoading3D,
    ] = useState(false);

    const [
        loadingInspection,
        setLoadingInspection,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState<string | null>(null);

    const [
        map3DError,
        setMap3DError,
    ] = useState<string | null>(null);

    const [
        inspectionError,
        setInspectionError,
    ] = useState<string | null>(null);

    const [
        clusterMinimumMembership,
        setClusterMinimumMembership,
    ] = useState(0);

    const [
        clusterYearRange,
        setClusterYearRange,
    ] = useState<YearRange | null>(null);

    const [
        clusterGroupIds,
        setClusterGroupIds,
    ] = useState<string[]>([]);

    const [
        showSurroundingClusters,
        setShowSurroundingClusters,
    ] = useState(true);

    const mode =
        getExplorerMode(
            explorer.selectedClusterId,
            explorer.selectedArtistId,
        );

    useEffect(
        () => {
            const controller =
                new AbortController();

            setLoading(true);
            setError(null);

            Promise.all([
                fetchEmbeddings2D(
                    controller.signal,
                ),
                fetchDashboardOptions(
                    controller.signal,
                ),
            ])
                .then(
                    ([
                         map,
                         dashboardOptions,
                     ]) => {
                        setData2D(map);
                        setOptions(
                            dashboardOptions,
                        );

                        if (
                            explorer.yearRange === null
                            && dashboardOptions.overview.birth_year_min !== null
                            && dashboardOptions.overview.birth_year_max !== null
                        ) {
                            explorer.setYearRange([
                                dashboardOptions.overview.birth_year_min,
                                dashboardOptions.overview.birth_year_max,
                            ]);
                        }
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
                                    : "Failed to load Explorer data",
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
        [],
    );

    useEffect(
        () => {
            if (
                loading
                || !options
                || initialSelectionAppliedRef.current
            ) {
                return;
            }

            const requestedArtistId =
                searchParams.get("artist");

            const requestedClusterValue =
                searchParams.get("cluster");

            const requestedClusterId =
                requestedClusterValue === null
                    ? null
                    : Number(
                        requestedClusterValue,
                    );

            const requestedView =
                searchParams.get("view");

            if (
                requestedView === "2d"
                || requestedView === "3d"
            ) {
                explorer.setViewMode(
                    requestedView,
                );
            }

            if (requestedArtistId) {
                const requestedArtist =
                    data2D.find(
                        (artist) =>
                            artist.id
                            === requestedArtistId,
                    );

                if (requestedArtist) {
                    explorer.setSelectedArtistId(
                        requestedArtist.id,
                    );

                    explorer.setSelectedClusterId(
                        requestedArtist.cluster,
                    );
                }
            } else if (
                requestedClusterId !== null
                && Number.isInteger(
                    requestedClusterId,
                )
                && requestedClusterId >= 0
            ) {
                explorer.setSelectedArtistId(
                    null,
                );

                explorer.setSelectedClusterId(
                    requestedClusterId,
                );
            }

            initialSelectionAppliedRef.current =
                true;
        },
        [
            data2D,
            explorer,
            loading,
            options,
            searchParams,
        ],
    );

    useEffect(
        () => {
            if (
                !initialSelectionAppliedRef.current
            ) {
                return;
            }

            const next =
                new URLSearchParams();

            if (
                explorer.selectedClusterId !== null
                && explorer.selectedClusterId >= 0
            ) {
                next.set(
                    "cluster",
                    String(
                        explorer.selectedClusterId,
                    ),
                );
            }

            if (explorer.selectedArtistId) {
                next.set(
                    "artist",
                    explorer.selectedArtistId,
                );
            }

            if (explorer.viewMode === "3d") {
                next.set(
                    "view",
                    "3d",
                );
            }

            if (
                next.toString()
                !== searchParams.toString()
            ) {
                setSearchParams(
                    next,
                    {
                        replace: true,
                    },
                );
            }
        },
        [
            explorer.selectedArtistId,
            explorer.selectedClusterId,
            explorer.viewMode,
            searchParams,
            setSearchParams,
        ],
    );

    useEffect(
        () => {
            if (
                mode !== "overview"
                || (
                    explorer.selectedGroupIds.length
                    === 0
                    && explorer.selectedLocationIds.length
                    === 0
                )
            ) {
                setAllowedArtistIds(null);
                return;
            }

            const controller =
                new AbortController();

            fetchFilteredArtistIds(
                explorer.selectedGroupIds,
                explorer.selectedLocationIds,
                controller.signal,
            )
                .then(
                    (response) =>
                        setAllowedArtistIds(
                            new Set(
                                response.artist_ids,
                            ),
                        ),
                )
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to apply graph filters",
                            );
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [
            explorer.selectedGroupIds,
            explorer.selectedLocationIds,
            mode,
        ],
    );

    useEffect(
        () => {
            const clusterId =
                explorer.selectedClusterId;

            setClusterMinimumMembership(0);
            setClusterYearRange(null);
            setClusterGroupIds([]);
            setShowSurroundingClusters(true);
            setInspectionError(null);

            if (
                clusterId === null
                || clusterId < 0
            ) {
                setInspection(null);
                setLoadingInspection(false);
                return;
            }

            const controller =
                new AbortController();

            setLoadingInspection(true);
            setInspection(null);

            fetchClusterInspection(
                clusterId,
                controller.signal,
            )
                .then(
                    (response) =>
                        setInspection(response),
                )
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setInspectionError(
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
                            setLoadingInspection(
                                false,
                            );
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [explorer.selectedClusterId],
    );

    const request3D =
        useCallback(
            () => {
                if (
                    data3D
                    || loading3D
                ) {
                    return;
                }

                setLoading3D(true);
                setMap3DError(null);

                fetchEmbeddings3D()
                    .then(setData3D)
                    .catch(
                        (reason: unknown) =>
                            setMap3DError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to load 3D map",
                            ),
                    )
                    .finally(
                        () =>
                            setLoading3D(false),
                    );
            },
            [
                data3D,
                loading3D,
            ],
        );

    const acceptsOverviewArtist =
        useCallback(
            (
                artist:
                    ArtistEmbedding2D
                    | ArtistEmbedding3D,
            ) => {
                if (
                    !explorer.showNoise
                    && artist.is_noise
                ) {
                    return false;
                }

                if (
                    explorer.selectedClusters.length
                    && !explorer.selectedClusters.includes(
                        artist.cluster,
                    )
                ) {
                    return false;
                }

                if (
                    artist.membership_probability
                    < explorer.minimumMembership
                ) {
                    return false;
                }

                if (
                    allowedArtistIds
                    && !allowedArtistIds.has(
                        artist.id,
                    )
                ) {
                    return false;
                }

                if (explorer.yearRange) {
                    if (
                        artist.birth_year === null
                        || artist.birth_year
                        < explorer.yearRange[0]
                        || artist.birth_year
                        > explorer.yearRange[1]
                    ) {
                        return false;
                    }
                }

                return true;
            },
            [
                allowedArtistIds,
                explorer.minimumMembership,
                explorer.selectedClusters,
                explorer.showNoise,
                explorer.yearRange,
            ],
        );

    const acceptsClusterArtist =
        useCallback(
            (artist: ClusterArtist) => {
                if (
                    artist.membership_probability
                    < clusterMinimumMembership
                ) {
                    return false;
                }

                if (clusterYearRange) {
                    if (
                        artist.birth_year === null
                        || artist.birth_year
                        < clusterYearRange[0]
                        || artist.birth_year
                        > clusterYearRange[1]
                    ) {
                        return false;
                    }
                }

                if (
                    clusterGroupIds.length
                    && !artist.groups.some(
                        (group) =>
                            clusterGroupIds.includes(
                                group.id,
                            ),
                    )
                ) {
                    return false;
                }

                return true;
            },
            [
                clusterGroupIds,
                clusterMinimumMembership,
                clusterYearRange,
            ],
        );

    const overviewData2D =
        useMemo(
            () =>
                data2D.filter(
                    acceptsOverviewArtist,
                ),
            [
                acceptsOverviewArtist,
                data2D,
            ],
        );

    const overviewData3D =
        useMemo(
            () =>
                data3D?.filter(
                    acceptsOverviewArtist,
                )
                ?? null,
            [
                acceptsOverviewArtist,
                data3D,
            ],
        );

    const filteredClusterArtists =
        useMemo(
            () =>
                inspection
                    ? inspection.artists.filter(
                        acceptsClusterArtist,
                    )
                    : [],
            [
                acceptsClusterArtist,
                inspection,
            ],
        );

    const filteredClusterArtistIds =
        useMemo(
            () =>
                new Set(
                    filteredClusterArtists.map(
                        (artist) =>
                            artist.id,
                    ),
                ),
            [filteredClusterArtists],
        );

    const selectedClusterId =
        explorer.selectedClusterId !== null
        && explorer.selectedClusterId >= 0
            ? explorer.selectedClusterId
            : null;

    const selectedClusterBoundary2D =
        useMemo(
            () =>
                selectedClusterId === null
                    ? []
                    : data2D.filter(
                        (artist) =>
                            artist.cluster
                            === selectedClusterId,
                    ),
            [
                data2D,
                selectedClusterId,
            ],
        );

    const selectedClusterBoundary3D =
        useMemo(
            () =>
                selectedClusterId === null
                    ? []
                    : data3D?.filter(
                        (artist) =>
                            artist.cluster
                            === selectedClusterId,
                    )
                    ?? [],
            [
                data3D,
                selectedClusterId,
            ],
        );

    const focusedData2D =
        useMemo(
            () => {
                if (
                    mode === "overview"
                    || selectedClusterId === null
                    || !inspection
                ) {
                    return overviewData2D;
                }

                if (!showSurroundingClusters) {
                    return data2D.filter(
                        (artist) =>
                            artist.cluster
                            === selectedClusterId
                            && filteredClusterArtistIds.has(
                                artist.id,
                            ),
                    );
                }

                return data2D.filter(
                    (artist) =>
                        artist.cluster
                        !== selectedClusterId
                        || filteredClusterArtistIds.has(
                            artist.id,
                        ),
                );
            },
            [
                data2D,
                filteredClusterArtistIds,
                inspection,
                mode,
                overviewData2D,
                selectedClusterId,
                showSurroundingClusters,
            ],
        );

    const focusedData3D =
        useMemo(
            () => {
                if (!data3D) {
                    return null;
                }

                if (
                    mode === "overview"
                    || selectedClusterId === null
                    || !inspection
                ) {
                    return overviewData3D;
                }

                if (!showSurroundingClusters) {
                    return data3D.filter(
                        (artist) =>
                            artist.cluster
                            === selectedClusterId
                            && filteredClusterArtistIds.has(
                                artist.id,
                            ),
                    );
                }

                return data3D.filter(
                    (artist) =>
                        artist.cluster
                        !== selectedClusterId
                        || filteredClusterArtistIds.has(
                            artist.id,
                        ),
                );
            },
            [
                data3D,
                filteredClusterArtistIds,
                inspection,
                mode,
                overviewData3D,
                selectedClusterId,
                showSurroundingClusters,
            ],
        );

    const selectedArtist =
        useMemo(
            () =>
                explorer.selectedArtistId
                    ? data2D.find(
                        (artist) =>
                            artist.id
                            === explorer.selectedArtistId,
                    )
                    ?? null
                    : null,
            [
                data2D,
                explorer.selectedArtistId,
            ],
        );

    const selectedClusterArtist =
        useMemo(
            () =>
                explorer.selectedArtistId
                && inspection
                    ? inspection.artists.find(
                        (artist) =>
                            artist.id
                            === explorer.selectedArtistId,
                    )
                    ?? null
                    : null,
            [
                explorer.selectedArtistId,
                inspection,
            ],
        );

    function showOverview() {
        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(null);
    }

    function showSelectedCluster() {
        explorer.setSelectedArtistId(null);
    }

    function selectCluster(
        clusterId: number | null,
    ) {
        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(
            clusterId,
        );
    }

    function selectArtist(
        artist:
            ArtistEmbedding2D
            | ArtistEmbedding3D,
    ) {
        explorer.setSelectedClusterId(
            artist.cluster,
        );

        explorer.setSelectedArtistId(
            artist.id,
        );
    }

    function resetClusterFilters() {
        setClusterMinimumMembership(0);
        setClusterYearRange(null);
        setClusterGroupIds([]);
        setShowSurroundingClusters(true);
    }

    if (loading) {
        return (
            <Box className="explorer-loading">
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
                        Loading ArtVis Explorer…
                    </Typography>
                </Box>
            </Box>
        );
    }

    if (error || !options) {
        return (
            <Box
                sx={{
                    p: 3,
                }}
            >
                <Alert severity="error">
                    {error
                        ?? "Dashboard options are missing"}
                </Alert>
            </Box>
        );
    }

    const visibleArtistCount =
        explorer.viewMode === "2d"
            ? focusedData2D.length
            : focusedData3D?.length
            ?? focusedData2D.length;

    const mapTitle =
        mode === "overview"
            ? "Embedding cluster map"
            : selectedClusterId !== null
                ? `Embedding map · Cluster ${selectedClusterId}`
                : "Embedding cluster map";

    return (
        <Box className="explorer-page">
            <ExplorerHeader
                mode={mode}
                clusters={options.clusters}
                selectedClusterId={
                    explorer.selectedClusterId
                }
                selectedArtist={
                    selectedArtist
                }
                onShowOverview={
                    showOverview
                }
                onShowCluster={
                    showSelectedCluster
                }
                onSelectCluster={
                    selectCluster
                }
            />

            <Box className="explorer-grid">
                <Panel className="explorer-filters-panel">
                    {mode === "overview"
                        ? (
                            <FilterSidebar
                                artists={data2D}
                                options={options}
                            />
                        )
                        : loadingInspection
                            ? (
                                <Box
                                    sx={{
                                        height: "100%",
                                        display: "grid",
                                        placeItems:
                                            "center",
                                    }}
                                >
                                    <CircularProgress />
                                </Box>
                            )
                            : inspection
                                ? (
                                    <ClusterFilterSidebar
                                        key={
                                            inspection.cluster
                                        }
                                        inspection={inspection}
                                        visibleArtistCount={
                                            filteredClusterArtists.length
                                        }
                                        minimumMembership={
                                            clusterMinimumMembership
                                        }
                                        onMinimumMembershipChange={
                                            setClusterMinimumMembership
                                        }
                                        yearRange={
                                            clusterYearRange
                                        }
                                        onYearRangeChange={
                                            setClusterYearRange
                                        }
                                        selectedGroupIds={
                                            clusterGroupIds
                                        }
                                        onSelectedGroupIdsChange={
                                            setClusterGroupIds
                                        }
                                        showSurroundingClusters={
                                            showSurroundingClusters
                                        }
                                        onShowSurroundingClustersChange={
                                            setShowSurroundingClusters
                                        }
                                        onReset={
                                            resetClusterFilters
                                        }
                                    />
                                )
                                : (
                                    <FilterSidebar
                                        artists={data2D}
                                        options={options}
                                    />
                                )}
                </Panel>

                <Panel className="explorer-map-panel">
                    <EmbeddingMap
                        data2D={focusedData2D}
                        data3D={focusedData3D}
                        loading3D={loading3D}
                        error3D={map3DError}
                        onRequest3D={request3D}
                        highlightClusterId={
                            selectedClusterId
                        }
                        highlightBoundaryData2D={
                            selectedClusterBoundary2D
                        }
                        highlightBoundaryData3D={
                            selectedClusterBoundary3D
                        }
                        dimNonHighlighted={
                            mode !== "overview"
                            && showSurroundingClusters
                        }
                        onArtistClick={
                            selectArtist
                        }
                        title={mapTitle}
                    />
                </Panel>

                <Panel className="explorer-details-panel">
                    {mode === "overview"
                        ? (
                            <OverviewPanel
                                overview={
                                    options.overview
                                }
                                visibleArtistCount={
                                    visibleArtistCount
                                }
                            />
                        )
                        : mode === "artist"
                        && selectedArtist
                            ? (
                                <ArtistDetailsPanel
                                    artist={
                                        selectedArtist
                                    }
                                    clusterArtist={
                                        selectedClusterArtist
                                    }
                                    onShowCluster={
                                        showSelectedCluster
                                    }
                                    onShowOverview={
                                        showOverview
                                    }
                                />
                            )
                            : loadingInspection
                                ? (
                                    <Box
                                        sx={{
                                            minHeight: 300,
                                            display: "grid",
                                            placeItems:
                                                "center",
                                        }}
                                    >
                                        <CircularProgress />
                                    </Box>
                                )
                                : inspectionError
                                    ? (
                                        <Box
                                            sx={{
                                                p: 2,
                                            }}
                                        >
                                            <Alert severity="error">
                                                {inspectionError}
                                            </Alert>
                                        </Box>
                                    )
                                    : inspection
                                        ? (
                                            <ClusterDetailsPanel
                                                inspection={
                                                    inspection
                                                }
                                                visibleArtistCount={
                                                    filteredClusterArtists.length
                                                }
                                            />
                                        )
                                        : (
                                            <Box
                                                sx={{
                                                    p: 2,
                                                }}
                                            >
                                                <Alert severity="info">
                                                    This Artist is not assigned to a computed cluster.
                                                </Alert>
                                            </Box>
                                        )}
                </Panel>

                <Panel
                    title={
                        mode === "cluster"
                        && selectedClusterId !== null
                            ? `Artists in Cluster ${selectedClusterId}`
                            : mode === "artist"
                                ? "Most similar Artists"
                                : "Selection results"
                    }
                    className="explorer-results-panel"
                >
                    {mode === "cluster"
                        ? loadingInspection
                            ? (
                                <Box
                                    sx={{
                                        p: 3,
                                        display: "grid",
                                        placeItems:
                                            "center",
                                    }}
                                >
                                    <CircularProgress />
                                </Box>
                            )
                            : inspectionError
                                ? (
                                    <Box
                                        sx={{
                                            p: 2,
                                        }}
                                    >
                                        <Alert severity="error">
                                            {inspectionError}
                                        </Alert>
                                    </Box>
                                )
                                : (
                                    <ClusterArtistsTable
                                        artists={
                                            filteredClusterArtists
                                        }
                                    />
                                )
                        : mode === "artist"
                            ? (
                                <SimilarArtistsTable
                                    selectedArtistName={
                                        artistName(
                                            selectedArtist,
                                        )
                                    }
                                />
                            )
                            : (
                                <Box
                                    sx={{
                                        p: 3,
                                        textAlign: "center",
                                    }}
                                >
                                    <Typography
                                        color="text.secondary"
                                    >
                                        Select an Artist point to inspect nearest neighbours, or select a cluster from the header to open Cluster Inspection in this same workspace.
                                    </Typography>
                                </Box>
                            )}
                </Panel>
            </Box>
        </Box>
    );
}
