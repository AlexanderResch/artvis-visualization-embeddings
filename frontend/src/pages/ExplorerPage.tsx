import {
    Alert,
    Box,
    Button,
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
    fetchArtistComparison,
} from "../api/comparisonApi";

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
    ComparisonDetailsPanel,
} from "../components/comparison/ComparisonDetailsPanel";

import {
    ComparisonSidebar,
} from "../components/comparison/ComparisonSidebar";

import {
    ComparisonWorkspace,
} from "../components/comparison/ComparisonWorkspace";

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

import {
    useArtistContext,
} from "../hooks/useArtistContext";

import type {
    ArtistInspectionResponse,
} from "../types/artistInspection";

import type {
    ClusterArtist,
    ClusterInspection,
} from "../types/cluster";

import type {
    ArtistComparisonResponse,
} from "../types/comparison";

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
        || value === "compare"
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
        comparisonArtistId,
        setComparisonArtistId,
    ] = useState<string | null>(null);

    const [
        comparisonSelectionActive,
        setComparisonSelectionActive,
    ] = useState(false);

    const [
        comparison,
        setComparison,
    ] = useState<ArtistComparisonResponse | null>(
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
        loadingClusterInspection,
        setLoadingClusterInspection,
    ] = useState(false);

    const [
        loadingArtistInspection,
        setLoadingArtistInspection,
    ] = useState(false);

    const [
        loadingComparison,
        setLoadingComparison,
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
        comparisonError,
        setComparisonError,
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

    const selectedNodeTypesArtistRef =
        useRef<string | null>(null);

    const availableNodeTypesRef =
        useRef<string[]>([]);

    const [
        selectedRelationshipTypes,
        setSelectedRelationshipTypes,
    ] = useState<string[]>([]);

    const selectedRelationshipTypesArtistRef =
        useRef<string | null>(null);

    const availableRelationshipTypesRef =
        useRef<string[]>([]);

    const [
        timelineBinSize,
        setTimelineBinSize,
    ] = useState<1 | 5 | 10>(1);

    const [
        comparisonShowMapContext,
        setComparisonShowMapContext,
    ] = useState(true);

    const [
        comparisonShowEdgeLabels,
        setComparisonShowEdgeLabels,
    ] = useState(true);

    const {
        context: artistContext,
        loading: loadingArtistContext,
        error: artistContextError,
    } = useArtistContext(
        explorer.selectedArtistId,
        mode === "overview"
        || mode === "artist",
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

            const requestedComparisonArtistId =
                searchParams.get("compare");

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

            const resolvedComparisonArtist =
                requestedComparisonArtistId
                && requestedComparisonArtistId
                !== resolvedArtist?.id
                    ? data2D.find(
                        (artist) =>
                            artist.id
                            === requestedComparisonArtistId,
                    )
                    ?? null
                    : null;

            setComparisonArtistId(
                resolvedComparisonArtist?.id
                ?? null,
            );

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

            if (
                modeFromUrl === "compare"
                && resolvedArtist
                && resolvedComparisonArtist
            ) {
                setMode("compare");
            } else if (
                modeFromUrl
                && modeFromUrl !== "compare"
            ) {
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

            if (comparisonArtistId) {
                next.set(
                    "compare",
                    comparisonArtistId,
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
            comparisonArtistId,
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
                setSelectedNodeTypes([]);
                selectedNodeTypesArtistRef.current = null;
                availableNodeTypesRef.current = [];
                setSelectedRelationshipTypes([]);
                selectedRelationshipTypesArtistRef.current = null;
                availableRelationshipTypesRef.current = [];
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

                        const previousAvailableTypes =
                            availableNodeTypesRef.current;

                        const artistChanged =
                            selectedNodeTypesArtistRef.current
                            !== artistId;

                        setSelectedNodeTypes(
                            (current) => {
                                const previouslyAllSelected =
                                    previousAvailableTypes.length === 0
                                    || previousAvailableTypes.every(
                                        (nodeType) =>
                                            current.includes(
                                                nodeType,
                                            ),
                                    );

                                if (
                                    artistChanged
                                    || previouslyAllSelected
                                ) {
                                    return availableTypes;
                                }

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

                        selectedNodeTypesArtistRef.current =
                            artistId;

                        availableNodeTypesRef.current =
                            availableTypes;

                        const availableRelationshipTypes =
                            response.ego.relationship_type_counts.map(
                                (item) =>
                                    item.type,
                            );

                        const previousAvailableRelationshipTypes =
                            availableRelationshipTypesRef.current;

                        const relationshipArtistChanged =
                            selectedRelationshipTypesArtistRef.current
                            !== artistId;

                        setSelectedRelationshipTypes(
                            (current) => {
                                const previouslyAllSelected =
                                    previousAvailableRelationshipTypes.length === 0
                                    || previousAvailableRelationshipTypes.every(
                                        (relationshipType) =>
                                            current.includes(
                                                relationshipType,
                                            ),
                                    );

                                if (
                                    relationshipArtistChanged
                                    || previouslyAllSelected
                                ) {
                                    return availableRelationshipTypes;
                                }

                                const retained =
                                    current.filter(
                                        (relationshipType) =>
                                            availableRelationshipTypes.includes(
                                                relationshipType,
                                            ),
                                    );

                                return retained.length > 0
                                    ? retained
                                    : availableRelationshipTypes;
                            },
                        );

                        selectedRelationshipTypesArtistRef.current =
                            artistId;

                        availableRelationshipTypesRef.current =
                            availableRelationshipTypes;
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

    useEffect(
        () => {
            const artistAId =
                explorer.selectedArtistId;

            setComparisonError(null);

            if (
                mode !== "compare"
                || !artistAId
                || !comparisonArtistId
                || artistAId === comparisonArtistId
            ) {
                setComparison(null);
                setLoadingComparison(false);
                return;
            }

            const controller =
                new AbortController();

            setLoadingComparison(true);
            setComparison(null);

            fetchArtistComparison(
                artistAId,
                comparisonArtistId,
                controller.signal,
            )
                .then(setComparison)
                .catch(
                    (reason: unknown) => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setComparisonError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to load Artist comparison",
                            );
                        }
                    },
                )
                .finally(
                    () => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setLoadingComparison(false);
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [
            comparisonArtistId,
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

                if (mode === "compare") {
                    if (
                        comparisonShowMapContext
                        || !comparisonArtistId
                        || !explorer.selectedArtistId
                    ) {
                        return data2D;
                    }

                    return data2D.filter(
                        (artist) =>
                            artist.id
                            === explorer.selectedArtistId
                            || artist.id
                            === comparisonArtistId,
                    );
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
                comparisonArtistId,
                comparisonShowMapContext,
                data2D,
                explorer.selectedArtistId,
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

                if (mode === "compare") {
                    if (
                        comparisonShowMapContext
                        || !comparisonArtistId
                        || !explorer.selectedArtistId
                    ) {
                        return data3D;
                    }

                    return data3D.filter(
                        (artist) =>
                            artist.id
                            === explorer.selectedArtistId
                            || artist.id
                            === comparisonArtistId,
                    );
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
                comparisonArtistId,
                comparisonShowMapContext,
                data3D,
                explorer.selectedArtistId,
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

    const comparisonArtist =
        useMemo(
            () =>
                comparisonArtistId
                    ? data2D.find(
                        (artist) =>
                            artist.id
                            === comparisonArtistId,
                    )
                    ?? null
                    : null,
            [
                comparisonArtistId,
                data2D,
            ],
        );

    const comparisonFocusData2D =
        useMemo(
            () =>
                selectedArtist
                && comparisonArtist
                    ? [
                        selectedArtist,
                        comparisonArtist,
                    ]
                    : [],
            [
                comparisonArtist,
                selectedArtist,
            ],
        );

    const comparisonFocusData3D =
        useMemo(
            () => {
                if (
                    !data3D
                    || !selectedArtist
                    || !comparisonArtist
                ) {
                    return [];
                }

                const targetIds =
                    new Set([
                        selectedArtist.id,
                        comparisonArtist.id,
                    ]);

                return data3D.filter(
                    (artist) =>
                        targetIds.has(
                            artist.id,
                        ),
                );
            },
            [
                comparisonArtist,
                data3D,
                selectedArtist,
            ],
        );

    const mapFocusData2D =
        useMemo(
            () => {
                if (mode === "compare") {
                    return comparisonFocusData2D;
                }

                if (mode === "artist") {
                    if (selectedClusterBoundary2D.length > 0) {
                        return selectedClusterBoundary2D;
                    }

                    return selectedArtist
                        ? [selectedArtist]
                        : [];
                }

                if (mode === "cluster") {
                    return selectedClusterBoundary2D;
                }

                return [];
            },
            [
                comparisonFocusData2D,
                mode,
                selectedArtist,
                selectedClusterBoundary2D,
            ],
        );

    const mapFocusData3D =
        useMemo(
            () => {
                if (mode === "compare") {
                    return comparisonFocusData3D;
                }

                if (mode === "artist") {
                    if (selectedClusterBoundary3D.length > 0) {
                        return selectedClusterBoundary3D;
                    }

                    if (!selectedArtist || !data3D) {
                        return [];
                    }

                    const selectedArtist3D =
                        data3D.find(
                            (artist) =>
                                artist.id === selectedArtist.id,
                        );

                    return selectedArtist3D
                        ? [selectedArtist3D]
                        : [];
                }

                if (mode === "cluster") {
                    return selectedClusterBoundary3D;
                }

                return [];
            },
            [
                comparisonFocusData3D,
                data3D,
                mode,
                selectedArtist,
                selectedClusterBoundary3D,
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

    function clearComparisonState() {
        setComparisonArtistId(null);
        setComparisonSelectionActive(false);
        setComparison(null);
        setComparisonError(null);
    }

    function showOverview() {
        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(null);
        clearComparisonState();
        setMode("overview");
    }

    function showSelectedCluster() {
        if (selectedClusterId !== null) {
            clearComparisonState();
            setMode("cluster");
        }
    }

    function inspectSelectedArtist() {
        if (selectedArtist) {
            clearComparisonState();
            setMode("artist");
        }
    }

    function inspectComparisonArtist() {
        if (!comparisonArtist) {
            return;
        }

        explorer.setSelectedArtistId(
            comparisonArtist.id,
        );
        explorer.setSelectedClusterId(
            comparisonArtist.cluster,
        );
        clearComparisonState();
        setMode("artist");
    }

    function startComparison() {
        if (!selectedArtist) {
            return;
        }

        setComparisonArtistId(null);
        setComparison(null);
        setComparisonError(null);
        setComparisonSelectionActive(true);
    }

    function cancelComparison() {
        setComparisonSelectionActive(false);
        setComparisonArtistId(null);
        setComparison(null);
        setComparisonError(null);
    }

    function selectCluster(
        clusterId: number | null,
    ) {
        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(
            clusterId,
        );
        clearComparisonState();
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
                if (
                    comparisonSelectionActive
                    || mode === "compare"
                ) {
                    if (
                        artist.id
                        === explorer.selectedArtistId
                    ) {
                        return;
                    }

                    setComparisonArtistId(
                        artist.id,
                    );
                    setComparisonSelectionActive(
                        false,
                    );
                    setMode("compare");
                    return;
                }

                explorer.setSelectedClusterId(
                    artist.cluster,
                );
                explorer.setSelectedArtistId(
                    artist.id,
                );
            },
            [
                comparisonSelectionActive,
                explorer,
                mode,
            ],
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
                clearComparisonState();
                setMode("artist");
            },
            [
                data2D,
                explorer,
            ],
        );

    function changeComparisonArtistA(
        artist: ArtistEmbedding2D,
    ) {
        explorer.setSelectedArtistId(
            artist.id,
        );
        explorer.setSelectedClusterId(
            artist.cluster,
        );
        setComparison(null);
        setMode("compare");
    }

    function changeComparisonArtistB(
        artist: ArtistEmbedding2D | null,
    ) {
        if (!artist) {
            setComparisonArtistId(null);
            setComparison(null);
            setComparisonSelectionActive(true);
            return;
        }

        if (
            artist.id
            === explorer.selectedArtistId
        ) {
            return;
        }

        setComparisonArtistId(artist.id);
        setComparisonSelectionActive(false);
        setMode("compare");
    }

    function swapComparisonArtists() {
        if (!comparisonArtist || !selectedArtist) {
            return;
        }

        const previousArtistA =
            selectedArtist;

        explorer.setSelectedArtistId(
            comparisonArtist.id,
        );
        explorer.setSelectedClusterId(
            comparisonArtist.cluster,
        );
        setComparisonArtistId(
            previousArtistA.id,
        );
        setComparison(null);
    }

    function resetComparison() {
        setComparisonArtistId(null);
        setComparison(null);
        setComparisonError(null);
        setComparisonSelectionActive(true);
    }

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
        setTimelineBinSize(1);
        setShowSurroundingClusters(true);

        setSelectedNodeTypes(
            artistInspection
                ? artistInspection.ego.node_type_counts.map(
                    (item) =>
                        item.type,
                )
                : [],
        );

        setSelectedRelationshipTypes(
            artistInspection
                ? artistInspection.ego.relationship_type_counts.map(
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

                <Button
                    variant="outlined"
                    onClick={() =>
                        window.location.reload()
                    }
                    sx={{
                        mt: 1.5,
                    }}
                >
                    Retry
                </Button>
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
        mode === "compare"
            ? null
            : mode === "overview"
            && !hasSelectedArtistPreview
                ? null
                : selectedClusterId;

    const mapTitle =
        mode === "compare"
        && selectedArtist
        && comparisonArtist
            ? `Embedding comparison · ${selectedArtist.display_name ?? selectedArtist.entity} ↔ ${comparisonArtist.display_name ?? comparisonArtist.entity}`
            : mode === "overview"
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
            : mode === "compare"
                ? "explorer-grid--compare"
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
                comparisonArtist={
                    comparisonArtist
                }
                comparisonSelectionActive={
                    comparisonSelectionActive
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
                onInspectComparisonArtist={
                    inspectComparisonArtist
                }
                onStartComparison={
                    startComparison
                }
                onCancelComparison={
                    cancelComparison
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
                        : mode === "compare"
                        && selectedArtist
                            ? (
                                <ComparisonSidebar
                                    artists={data2D}
                                    artistA={selectedArtist}
                                    artistB={comparisonArtist}
                                    selectingSecondArtist={
                                        comparisonSelectionActive
                                    }
                                    showMapContext={
                                        comparisonShowMapContext
                                    }
                                    showEdgeLabels={
                                        comparisonShowEdgeLabels
                                    }
                                    onArtistAChange={
                                        changeComparisonArtistA
                                    }
                                    onArtistBChange={
                                        changeComparisonArtistB
                                    }
                                    onShowMapContextChange={
                                        setComparisonShowMapContext
                                    }
                                    onShowEdgeLabelsChange={
                                        setComparisonShowEdgeLabels
                                    }
                                    onSwap={
                                        swapComparisonArtists
                                    }
                                    onReset={
                                        resetComparison
                                    }
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
                                        relationshipTypeCounts={
                                            artistInspection?.ego.relationship_type_counts
                                            ?? []
                                        }
                                        selectedRelationshipTypes={
                                            selectedRelationshipTypes
                                        }
                                        onSelectedRelationshipTypesChange={
                                            setSelectedRelationshipTypes
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
                            && mode !== "compare"
                            && showSurroundingClusters
                        }
                        comparisonArtistIds={
                            selectedArtist
                            && comparisonArtist
                                ? [
                                    selectedArtist.id,
                                    comparisonArtist.id,
                                ]
                                : null
                        }
                        dimNonCompared={
                            mode === "compare"
                            && comparisonShowMapContext
                        }
                        focusData2D={
                            mapFocusData2D
                        }
                        focusData3D={
                            mapFocusData3D
                        }
                        onArtistClick={
                            selectArtist
                        }
                        title={mapTitle}
                        description={
                            comparisonSelectionActive
                                ? "Select a second Artist point to start the comparison."
                                : mode === "compare"
                                    ? "The compared Artists are marked as A and B and connected by a dashed line."
                                    : mode === "artist"
                                        ? (selectedArtist?.cluster ?? -1) >= 0
                                            ? "The selected Artist is highlighted. Its computed cluster remains visible as spatial context."
                                            : "The selected Noise Artist is highlighted in the full embedding context."
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
                                    artistContext={
                                        artistContext
                                    }
                                    createdItemsLoading={
                                        loadingArtistContext
                                    }
                                    createdItemsError={
                                        artistContextError
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
                        : mode === "compare"
                            ? loadingComparison
                                ? (
                                    <Box
                                        sx={{
                                            minHeight: 300,
                                            display: "grid",
                                            placeItems: "center",
                                        }}
                                    >
                                        <CircularProgress />
                                    </Box>
                                )
                                : comparisonError
                                    ? (
                                        <Box sx={{ p: 2 }}>
                                            <Alert severity="error">
                                                {comparisonError}
                                            </Alert>
                                        </Box>
                                    )
                                    : comparison
                                        ? (
                                            <ComparisonDetailsPanel
                                                comparison={
                                                    comparison
                                                }
                                            />
                                        )
                                        : (
                                            <Box sx={{ p: 2 }}>
                                                <Alert severity="info">
                                                    Select a second Artist to load the comparison.
                                                </Alert>
                                            </Box>
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
                                            artistContext={
                                                artistContext
                                            }
                                            createdItems={
                                                artistInspection
                                                    ?.items
                                                ?? []
                                            }
                                            createdItemsLoading={
                                                loadingArtistContext
                                            }
                                            createdItemsError={
                                                artistContextError
                                            }
                                            createdItemsNote={
                                                artistInspection
                                                    ?.items_note
                                                ?? null
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

                {mode === "compare" && (
                    <Panel
                        title="Shared graph context and connecting path"
                        className="explorer-results-panel explorer-results-panel--comparison"
                    >
                        <ComparisonWorkspace
                            comparison={comparison}
                            loading={loadingComparison}
                            error={comparisonError}
                            showEdgeLabels={
                                comparisonShowEdgeLabels
                            }
                            onSelectArtist={
                                selectArtistById
                            }
                        />
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
                                selectedRelationshipTypes={
                                    selectedRelationshipTypes
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
