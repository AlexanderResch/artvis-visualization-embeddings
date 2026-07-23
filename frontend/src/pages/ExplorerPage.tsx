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
    fetchArtistInspection,
} from "../api/artistInspectionApi";

import {
    fetchSimilarArtists,
} from "../api/artistsApi";

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
    ArtistInspectionSidebar,
} from "../components/artist/ArtistInspectionSidebar";

import {
    ArtistInspectionWorkspace,
} from "../components/artist/ArtistInspectionWorkspace";

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
    ArtistInspectionResponse,
} from "../types/artistInspection";

import type {
    ClusterArtist,
    ClusterInspection,
} from "../types/cluster";

import type {
    DashboardOptions,
    SimilarArtist,
} from "../types/dashboard";

import type {
    ArtistEmbedding2D,
    ArtistEmbedding3D,
} from "../types/embedding";


function validClusterId(
    clusterId: number | null,
): number | null {
    return clusterId !== null
    && clusterId >= 0
        ? clusterId
        : null;
}


function requestedMode(
    value: string | null,
): ExplorerMode | null {
    if (
        value === "overview"
        || value === "cluster"
        || value === "artist"
    ) {
        return value;
    }

    return null;
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
        mode,
        setMode,
    ] = useState<ExplorerMode>(
        "overview",
    );

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
        clusterInspection,
        setClusterInspection,
    ] = useState<ClusterInspection | null>(
        null,
    );

    const [
        artistInspection,
        setArtistInspection,
    ] = useState<ArtistInspectionResponse | null>(
        null,
    );

    const [
        similarArtists,
        setSimilarArtists,
    ] = useState<SimilarArtist[]>([]);

    const [
        loading,
        setLoading,
    ] = useState(true);

    const [
        loading3D,
        setLoading3D,
    ] = useState(false);

    const [
        loadingClusterInspection,
        setLoadingClusterInspection,
    ] = useState(false);

    const [
        loadingArtistInspection,
        setLoadingArtistInspection,
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
        clusterInspectionError,
        setClusterInspectionError,
    ] = useState<string | null>(null);

    const [
        artistInspectionError,
        setArtistInspectionError,
    ] = useState<string | null>(null);

    const [
        similarArtistsError,
        setSimilarArtistsError,
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

    const [
        similarityThreshold,
        setSimilarityThreshold,
    ] = useState(0.7);

    const [
        similarArtistLimit,
        setSimilarArtistLimit,
    ] = useState(10);

    const [
        egoDepth,
        setEgoDepth,
    ] = useState<1 | 2>(2);

    const [
        selectedNodeTypes,
        setSelectedNodeTypes,
    ] = useState<string[]>([]);

    const [
        timelineBinSize,
        setTimelineBinSize,
    ] = useState<1 | 5 | 10>(5);

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

            const modeFromUrl =
                requestedMode(
                    searchParams.get("mode"),
                );

            if (
                requestedView === "2d"
                || requestedView === "3d"
            ) {
                explorer.setViewMode(
                    requestedView,
                );
            }

            let resolvedArtist:
                ArtistEmbedding2D | null =
                null;

            if (requestedArtistId) {
                resolvedArtist =
                    data2D.find(
                        (artist) =>
                            artist.id
                            === requestedArtistId,
                    )
                    ?? null;

                if (resolvedArtist) {
                    explorer.setSelectedArtistId(
                        resolvedArtist.id,
                    );
                    explorer.setSelectedClusterId(
                        resolvedArtist.cluster,
                    );
                }
            }

            const clusterFromUrlIsValid =
                requestedClusterId !== null
                && Number.isInteger(
                    requestedClusterId,
                )
                && requestedClusterId >= 0;

            if (
                !resolvedArtist
                && clusterFromUrlIsValid
            ) {
                explorer.setSelectedArtistId(
                    null,
                );
                explorer.setSelectedClusterId(
                    requestedClusterId,
                );
            }

            if (modeFromUrl) {
                setMode(modeFromUrl);
            } else if (resolvedArtist) {
                setMode("overview");
            } else if (clusterFromUrlIsValid) {
                setMode("cluster");
            } else {
                setMode("overview");
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

            if (
                mode !== "overview"
                || explorer.selectedArtistId
                || validClusterId(
                    explorer.selectedClusterId,
                ) !== null
            ) {
                next.set(
                    "mode",
                    mode,
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
            mode,
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
            setClusterInspectionError(null);

            if (
                clusterId === null
                || clusterId < 0
            ) {
                setClusterInspection(null);
                setLoadingClusterInspection(false);
                return;
            }

            const controller =
                new AbortController();

            setLoadingClusterInspection(true);
            setClusterInspection(null);

            fetchClusterInspection(
                clusterId,
                controller.signal,
            )
                .then(
                    (response) =>
                        setClusterInspection(
                            response,
                        ),
                )
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setClusterInspectionError(
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
                            setLoadingClusterInspection(
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

    useEffect(
        () => {
            const artistId =
                explorer.selectedArtistId;

            setArtistInspectionError(null);

            if (
                mode !== "artist"
                || !artistId
            ) {
                setArtistInspection(null);
                setLoadingArtistInspection(false);
                return;
            }

            const controller =
                new AbortController();

            setLoadingArtistInspection(true);

            fetchArtistInspection(
                artistId,
                egoDepth,
                350,
                controller.signal,
            )
                .then(
                    (response) => {
                        setArtistInspection(
                            response,
                        );

                        const availableTypes =
                            response.ego.node_type_counts.map(
                                (item) =>
                                    item.type,
                            );

                        setSelectedNodeTypes(
                            (current) => {
                                const retained =
                                    current.filter(
                                        (nodeType) =>
                                            availableTypes.includes(
                                                nodeType,
                                            ),
                                    );

                                return retained.length > 0
                                    ? retained
                                    : availableTypes;
                            },
                        );
                    },
                )
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setArtistInspectionError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to load Artist inspection data",
                            );
                        }
                    },
                )
                .finally(
                    () => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setLoadingArtistInspection(
                                false,
                            );
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [
            egoDepth,
            explorer.selectedArtistId,
            mode,
        ],
    );

    useEffect(
        () => {
            const artistId =
                explorer.selectedArtistId;

            setSimilarArtistsError(null);

            if (
                mode !== "artist"
                || !artistId
            ) {
                setSimilarArtists([]);
                return;
            }

            const controller =
                new AbortController();

            fetchSimilarArtists(
                artistId,
                50,
                controller.signal,
            )
                .then(
                    setSimilarArtists,
                )
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setSimilarArtistsError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to load similar Artists",
                            );
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [
            explorer.selectedArtistId,
            mode,
        ],
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
                clusterInspection
                    ? clusterInspection.artists.filter(
                        acceptsClusterArtist,
                    )
                    : [],
            [
                acceptsClusterArtist,
                clusterInspection,
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
        validClusterId(
            explorer.selectedClusterId,
        );

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
                if (mode === "overview") {
                    return overviewData2D;
                }

                if (mode === "artist") {
                    if (
                        selectedClusterId === null
                        || showSurroundingClusters
                    ) {
                        return data2D;
                    }

                    return data2D.filter(
                        (artist) =>
                            artist.cluster
                            === selectedClusterId,
                    );
                }

                if (
                    selectedClusterId === null
                    || !clusterInspection
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
                clusterInspection,
                data2D,
                filteredClusterArtistIds,
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

                if (mode === "overview") {
                    return overviewData3D;
                }

                if (mode === "artist") {
                    if (
                        selectedClusterId === null
                        || showSurroundingClusters
                    ) {
                        return data3D;
                    }

                    return data3D.filter(
                        (artist) =>
                            artist.cluster
                            === selectedClusterId,
                    );
                }

                if (
                    selectedClusterId === null
                    || !clusterInspection
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
                clusterInspection,
                data3D,
                filteredClusterArtistIds,
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
                && clusterInspection
                    ? clusterInspection.artists.find(
                        (artist) =>
                            artist.id
                            === explorer.selectedArtistId,
                    )
                    ?? null
                    : null,
            [
                clusterInspection,
                explorer.selectedArtistId,
            ],
        );

    const visibleSimilarArtists =
        useMemo(
            () =>
                similarArtists
                    .filter(
                        (artist) =>
                            artist.similarity
                            >= similarityThreshold,
                    )
                    .slice(
                        0,
                        similarArtistLimit,
                    ),
            [
                similarArtistLimit,
                similarArtists,
                similarityThreshold,
            ],
        );

    function showOverview() {
        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(null);
        setMode("overview");
    }

    function showSelectedCluster() {
        if (selectedClusterId !== null) {
            setMode("cluster");
        }
    }

    function inspectSelectedArtist() {
        if (selectedArtist) {
            setMode("artist");
        }
    }

    function selectCluster(
        clusterId: number | null,
    ) {
        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(
            clusterId,
        );
        setMode(
            clusterId === null
                ? "overview"
                : "cluster",
        );
    }

    const selectArtist =
        useCallback(
            (
                artist:
                    ArtistEmbedding2D
                    | ArtistEmbedding3D,
            ) => {
                explorer.setSelectedClusterId(
                    artist.cluster,
                );
                explorer.setSelectedArtistId(
                    artist.id,
                );
            },
            [explorer],
        );

    const selectArtistById =
        useCallback(
            (artistId: string) => {
                const artist =
                    data2D.find(
                        (candidate) =>
                            candidate.id
                            === artistId,
                    );

                if (!artist) {
                    return;
                }

                explorer.setSelectedClusterId(
                    artist.cluster,
                );
                explorer.setSelectedArtistId(
                    artist.id,
                );
                setMode("artist");
            },
            [
                data2D,
                explorer,
            ],
        );

    function resetClusterFilters() {
        setClusterMinimumMembership(0);
        setClusterYearRange(null);
        setClusterGroupIds([]);
        setShowSurroundingClusters(true);
    }

    function resetArtistAnalysis() {
        setSimilarityThreshold(0.7);
        setSimilarArtistLimit(10);
        setEgoDepth(2);
        setTimelineBinSize(5);
        setShowSurroundingClusters(true);

        setSelectedNodeTypes(
            artistInspection
                ? artistInspection.ego.node_type_counts.map(
                    (item) =>
                        item.type,
                )
                : [],
        );
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

    const hasSelectedArtistPreview =
        mode === "overview"
        && selectedArtist !== null;

    const mapHighlightClusterId =
        mode === "overview"
        && !hasSelectedArtistPreview
            ? null
            : selectedClusterId;

    const mapTitle =
        mode === "overview"
            ? selectedArtist
                ? `Embedding map · ${selectedArtist.display_name ?? selectedArtist.entity}`
                : "Embedding cluster map"
            : mode === "artist"
            && selectedArtist
                ? `Embedding map · ${selectedArtist.display_name ?? selectedArtist.entity}`
                : selectedClusterId !== null
                    ? `Embedding map · Cluster ${selectedClusterId}`
                    : "Embedding cluster map";

    const gridClass =
        mode === "artist"
            ? "explorer-grid--artist"
            : mode === "overview"
            && !hasSelectedArtistPreview
                ? "explorer-grid--overview"
                : "explorer-grid--with-results";

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
                onInspectArtist={
                    inspectSelectedArtist
                }
                onSelectCluster={
                    selectCluster
                }
            />

            <Box
                className={
                    `explorer-grid ${gridClass}`
                }
            >
                <Panel className="explorer-filters-panel">
                    {mode === "overview"
                        ? (
                            <FilterSidebar
                                artists={data2D}
                                options={options}
                            />
                        )
                        : mode === "artist"
                        && selectedArtist
                            ? (
                                <ArtistInspectionSidebar
                                    artist={selectedArtist}
                                    similarityThreshold={
                                        similarityThreshold
                                    }
                                    onSimilarityThresholdChange={
                                        setSimilarityThreshold
                                    }
                                    similarArtistLimit={
                                        similarArtistLimit
                                    }
                                    onSimilarArtistLimitChange={
                                        setSimilarArtistLimit
                                    }
                                    egoDepth={egoDepth}
                                    onEgoDepthChange={
                                        setEgoDepth
                                    }
                                    nodeTypeCounts={
                                        artistInspection?.ego.node_type_counts
                                        ?? []
                                    }
                                    selectedNodeTypes={
                                        selectedNodeTypes
                                    }
                                    onSelectedNodeTypesChange={
                                        setSelectedNodeTypes
                                    }
                                    timelineBinSize={
                                        timelineBinSize
                                    }
                                    onTimelineBinSizeChange={
                                        setTimelineBinSize
                                    }
                                    showSurroundingClusters={
                                        showSurroundingClusters
                                    }
                                    onShowSurroundingClustersChange={
                                        setShowSurroundingClusters
                                    }
                                    onReset={
                                        resetArtistAnalysis
                                    }
                                />
                            )
                            : loadingClusterInspection
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
                                : clusterInspection
                                    ? (
                                        <ClusterFilterSidebar
                                            key={
                                                clusterInspection.cluster
                                            }
                                            inspection={
                                                clusterInspection
                                            }
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
                            mapHighlightClusterId
                        }
                        highlightBoundaryData2D={
                            mapHighlightClusterId === null
                                ? []
                                : selectedClusterBoundary2D
                        }
                        highlightBoundaryData3D={
                            mapHighlightClusterId === null
                                ? []
                                : selectedClusterBoundary3D
                        }
                        dimNonHighlighted={
                            mode !== "overview"
                            && showSurroundingClusters
                        }
                        onArtistClick={
                            selectArtist
                        }
                        title={mapTitle}
                        description={
                            mode === "artist"
                                ? "The selected Artist is highlighted. Its computed cluster remains visible as spatial context."
                                : undefined
                        }
                    />
                </Panel>

                <Panel className="explorer-details-panel">
                    {mode === "overview"
                        ? selectedArtist
                            ? (
                                <ArtistDetailsPanel
                                    artist={
                                        selectedArtist
                                    }
                                    clusterArtist={
                                        selectedClusterArtist
                                    }
                                    showSimilarArtists={
                                        false
                                    }
                                />
                            )
                            : (
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
                                <Box>
                                    {similarArtistsError && (
                                        <Alert
                                            severity="warning"
                                            sx={{
                                                m: 1.5,
                                                mb: 0,
                                            }}
                                        >
                                            {similarArtistsError}
                                        </Alert>
                                    )}

                                    <ArtistDetailsPanel
                                        artist={
                                            selectedArtist
                                        }
                                        clusterArtist={
                                            selectedClusterArtist
                                        }
                                        similarArtists={
                                            visibleSimilarArtists
                                        }
                                        totalSimilarArtistCount={
                                            similarArtists.length
                                        }
                                        similarityThreshold={
                                            similarityThreshold
                                        }
                                        onSelectSimilarArtist={
                                            selectArtistById
                                        }
                                    />
                                </Box>
                            )
                            : loadingClusterInspection
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
                                : clusterInspectionError
                                    ? (
                                        <Box
                                            sx={{
                                                p: 2,
                                            }}
                                        >
                                            <Alert severity="error">
                                                {clusterInspectionError}
                                            </Alert>
                                        </Box>
                                    )
                                    : clusterInspection
                                        ? (
                                            <ClusterDetailsPanel
                                                inspection={
                                                    clusterInspection
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

                {mode === "overview"
                    && selectedArtist && (
                        <Panel
                            title="Most similar Artists"
                            className="explorer-results-panel"
                        >
                            <SimilarArtistsTable
                                selectedArtistName={
                                    selectedArtist.display_name
                                }
                            />
                        </Panel>
                    )}

                {mode === "cluster" && (
                    <Panel
                        title={
                            selectedClusterId !== null
                                ? `Artists in Cluster ${selectedClusterId}`
                                : "Cluster Artists"
                        }
                        className="explorer-results-panel"
                    >
                        {loadingClusterInspection
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
                            : clusterInspectionError
                                ? (
                                    <Box
                                        sx={{
                                            p: 2,
                                        }}
                                    >
                                        <Alert severity="error">
                                            {clusterInspectionError}
                                        </Alert>
                                    </Box>
                                )
                                : (
                                    <ClusterArtistsTable
                                        artists={
                                            filteredClusterArtists
                                        }
                                    />
                                )}
                    </Panel>
                )}

                {mode === "artist"
                    && selectedArtist && (
                        <Panel
                            title="Artist graph context and activity"
                            className="explorer-results-panel explorer-results-panel--artist"
                        >
                            <ArtistInspectionWorkspace
                                artist={
                                    selectedArtist
                                }
                                inspection={
                                    artistInspection
                                }
                                loading={
                                    loadingArtistInspection
                                }
                                error={
                                    artistInspectionError
                                }
                                selectedNodeTypes={
                                    selectedNodeTypes
                                }
                                timelineBinSize={
                                    timelineBinSize
                                }
                                onSelectArtist={
                                    selectArtistById
                                }
                            />
                        </Panel>
                    )}
            </Box>
        </Box>
    );
}
