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
    ClusterComparisonDetailsPanel,
} from "../components/cluster/ClusterComparisonDetailsPanel";

import {
    ClusterComparisonSidebar,
} from "../components/cluster/ClusterComparisonSidebar";

import {
    ClusterComparisonWorkspace,
} from "../components/cluster/ClusterComparisonWorkspace";

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
    GenderFilterValue,
    GroupMembershipFilter,
} from "../types/embedding";


function normalizedGender(
    gender: string | null | undefined,
): GenderFilterValue {
    const normalized =
        (gender ?? "")
            .trim()
            .toUpperCase();

    if (normalized === "F") {
        return "F";
    }

    if (normalized === "M") {
        return "M";
    }

    return "UNKNOWN";
}


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
        || value === "cluster-compare"
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
        mapResetRequestKey,
        setMapResetRequestKey,
    ] = useState(0);

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
        filteredClusterInspection,
        setFilteredClusterInspection,
    ] = useState<ClusterInspection | null>(
        null,
    );

    const [
        loadingFilteredClusterInspection,
        setLoadingFilteredClusterInspection,
    ] = useState(false);

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
        comparisonClusterId,
        setComparisonClusterId,
    ] = useState<number | null>(null);

    const [
        comparisonClusterInspection,
        setComparisonClusterInspection,
    ] = useState<ClusterInspection | null>(null);

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
        loadingClusterComparison,
        setLoadingClusterComparison,
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
        clusterComparisonError,
        setClusterComparisonError,
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
        clusterGroupMembership,
        setClusterGroupMembership,
    ] = useState<GroupMembershipFilter>("all");

    const [
        clusterLocationIds,
        setClusterLocationIds,
    ] = useState<string[]>([]);

    const [
        clusterSelectedGenders,
        setClusterSelectedGenders,
    ] = useState<GenderFilterValue[]>([]);

    const [
        clusterMinimumExhibitedItems,
        setClusterMinimumExhibitedItems,
    ] = useState(0);

    const [
        comparisonMinimumMembership,
        setComparisonMinimumMembership,
    ] = useState(0);

    const [
        comparisonYearRange,
        setComparisonYearRange,
    ] = useState<YearRange | null>(null);

    const [
        comparisonGroupIds,
        setComparisonGroupIds,
    ] = useState<string[]>([]);

    const [
        comparisonGroupMembership,
        setComparisonGroupMembership,
    ] = useState<GroupMembershipFilter>("all");

    const [
        comparisonLocationIds,
        setComparisonLocationIds,
    ] = useState<string[]>([]);

    const [
        comparisonSelectedGenders,
        setComparisonSelectedGenders,
    ] = useState<GenderFilterValue[]>([]);

    const [
        comparisonMinimumExhibitedItems,
        setComparisonMinimumExhibitedItems,
    ] = useState(0);

    const [
        filteredComparisonInspectionA,
        setFilteredComparisonInspectionA,
    ] = useState<ClusterInspection | null>(null);

    const [
        filteredComparisonInspectionB,
        setFilteredComparisonInspectionB,
    ] = useState<ClusterInspection | null>(null);

    const [
        loadingFilteredClusterComparison,
        setLoadingFilteredClusterComparison,
    ] = useState(false);

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

            const requestedComparisonClusterValue =
                searchParams.get("cluster_b");

            const requestedComparisonClusterId =
                requestedComparisonClusterValue === null
                    ? null
                    : Number(requestedComparisonClusterValue);

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

            const comparisonClusterFromUrlIsValid =
                requestedComparisonClusterId !== null
                && Number.isInteger(requestedComparisonClusterId)
                && requestedComparisonClusterId >= 0
                && requestedComparisonClusterId !== requestedClusterId;

            setComparisonClusterId(
                comparisonClusterFromUrlIsValid
                    ? requestedComparisonClusterId
                    : null,
            );

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
                modeFromUrl === "cluster-compare"
                && clusterFromUrlIsValid
            ) {
                setMode("cluster-compare");
            } else if (
                modeFromUrl
                && modeFromUrl !== "compare"
                && modeFromUrl !== "cluster-compare"
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
                mode === "cluster-compare"
                && comparisonClusterId !== null
            ) {
                next.set(
                    "cluster_b",
                    String(comparisonClusterId),
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
            comparisonClusterId,
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
                explorer.selectedGroupIds.length === 0
                && explorer.selectedLocationIds.length === 0
                && explorer.groupMembership === "all"
            ) {
                setAllowedArtistIds(null);
                return;
            }

            const controller =
                new AbortController();

            fetchFilteredArtistIds(
                explorer.selectedGroupIds,
                explorer.selectedLocationIds,
                explorer.groupMembership,
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
            explorer.groupMembership,
        ],
    );

    useEffect(
        () => {
            const clusterId =
                explorer.selectedClusterId;

            setClusterMinimumMembership(explorer.minimumMembership);
            setClusterYearRange(explorer.yearRange);
            setClusterGroupIds(explorer.selectedGroupIds);
            setClusterGroupMembership(explorer.groupMembership);
            setClusterLocationIds(explorer.selectedLocationIds);
            setClusterSelectedGenders(explorer.selectedGenders);
            setClusterMinimumExhibitedItems(explorer.minimumExhibitedItems);
            setShowSurroundingClusters(true);
            setFilteredClusterInspection(null);
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
            if (mode !== "cluster" || !clusterInspection) {
                setFilteredClusterInspection(null);
                setLoadingFilteredClusterInspection(false);
                return;
            }

            const hasFilters =
                clusterSelectedGenders.length > 0
                || clusterMinimumMembership > 0
                || clusterMinimumExhibitedItems > 0
                || clusterYearRange !== null
                || clusterGroupIds.length > 0
                || clusterGroupMembership !== "all"
                || clusterLocationIds.length > 0;

            if (!hasFilters) {
                setFilteredClusterInspection(clusterInspection);
                setLoadingFilteredClusterInspection(false);
                return;
            }

            const controller = new AbortController();
            const timer = window.setTimeout(() => {
                setLoadingFilteredClusterInspection(true);
                setClusterInspectionError(null);

                fetchClusterInspection(
                    clusterInspection.cluster,
                    controller.signal,
                    {
                        genders: clusterSelectedGenders,
                        minimumMembership: clusterMinimumMembership,
                        minimumExhibitedItems: clusterMinimumExhibitedItems,
                        birthYearMin: clusterYearRange?.[0] ?? null,
                        birthYearMax: clusterYearRange?.[1] ?? null,
                        groupIds: clusterGroupIds,
                        groupMembership: clusterGroupMembership,
                        locationIds: clusterLocationIds,
                    },
                )
                    .then(setFilteredClusterInspection)
                    .catch((reason: unknown) => {
                        if (!controller.signal.aborted) {
                            setClusterInspectionError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to apply cluster filters",
                            );
                        }
                    })
                    .finally(() => {
                        if (!controller.signal.aborted) {
                            setLoadingFilteredClusterInspection(false);
                        }
                    });
            }, 180);

            return () => {
                window.clearTimeout(timer);
                controller.abort();
            };
        },
        [
            clusterGroupIds,
            clusterGroupMembership,
            clusterInspection,
            clusterLocationIds,
            clusterMinimumExhibitedItems,
            clusterMinimumMembership,
            clusterSelectedGenders,
            clusterYearRange,
            mode,
        ],
    );

    useEffect(
        () => {
            setClusterComparisonError(null);

            if (
                mode !== "cluster-compare"
                || comparisonClusterId === null
                || comparisonClusterId < 0
                || comparisonClusterId === validClusterId(
                    explorer.selectedClusterId,
                )
            ) {
                setComparisonClusterInspection(null);
                setLoadingClusterComparison(false);
                return;
            }

            const controller = new AbortController();

            setLoadingClusterComparison(true);
            setComparisonClusterInspection(null);

            fetchClusterInspection(
                comparisonClusterId,
                controller.signal,
            )
                .then(setComparisonClusterInspection)
                .catch((reason: unknown) => {
                    if (!controller.signal.aborted) {
                        setClusterComparisonError(
                            reason instanceof Error
                                ? reason.message
                                : "Failed to load cluster comparison",
                        );
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setLoadingClusterComparison(false);
                    }
                });

            return () => controller.abort();
        },
        [
            comparisonClusterId,
            explorer.selectedClusterId,
            mode,
        ],
    );

    useEffect(
        () => {
            if (mode !== "cluster-compare") {
                setFilteredComparisonInspectionA(null);
                setFilteredComparisonInspectionB(null);
                setLoadingFilteredClusterComparison(false);
                return;
            }

            const clusterAId = validClusterId(explorer.selectedClusterId);
            const clusterBId = comparisonClusterId;

            if (clusterAId === null) {
                setFilteredComparisonInspectionA(null);
                setFilteredComparisonInspectionB(null);
                setLoadingFilteredClusterComparison(false);
                return;
            }

            const hasFilters =
                comparisonSelectedGenders.length > 0
                || comparisonMinimumMembership > 0
                || comparisonMinimumExhibitedItems > 0
                || comparisonYearRange !== null
                || comparisonGroupIds.length > 0
                || comparisonGroupMembership !== "all"
                || comparisonLocationIds.length > 0;

            if (!hasFilters) {
                setFilteredComparisonInspectionA(clusterInspection);
                setFilteredComparisonInspectionB(comparisonClusterInspection);
                setLoadingFilteredClusterComparison(false);
                return;
            }

            const controller = new AbortController();
            const timer = window.setTimeout(() => {
                setLoadingFilteredClusterComparison(true);
                setClusterComparisonError(null);

                const filters = {
                    genders: comparisonSelectedGenders,
                    minimumMembership: comparisonMinimumMembership,
                    minimumExhibitedItems: comparisonMinimumExhibitedItems,
                    birthYearMin: comparisonYearRange?.[0] ?? null,
                    birthYearMax: comparisonYearRange?.[1] ?? null,
                    groupIds: comparisonGroupIds,
                    groupMembership: comparisonGroupMembership,
                    locationIds: comparisonLocationIds,
                };

                const requests = [
                    fetchClusterInspection(
                        clusterAId,
                        controller.signal,
                        filters,
                    ).then((response) => {
                        setFilteredComparisonInspectionA(response);
                    }),
                ];

                if (
                    clusterBId !== null
                    && clusterBId >= 0
                    && clusterBId !== clusterAId
                ) {
                    requests.push(
                        fetchClusterInspection(
                            clusterBId,
                            controller.signal,
                            filters,
                        ).then((response) => {
                            setFilteredComparisonInspectionB(response);
                        }),
                    );
                } else {
                    setFilteredComparisonInspectionB(null);
                }

                Promise.all(requests)
                    .catch((reason: unknown) => {
                        if (!controller.signal.aborted) {
                            setClusterComparisonError(
                                reason instanceof Error
                                    ? reason.message
                                    : "Failed to apply cluster comparison filters",
                            );
                        }
                    })
                    .finally(() => {
                        if (!controller.signal.aborted) {
                            setLoadingFilteredClusterComparison(false);
                        }
                    });
            }, 180);

            return () => {
                window.clearTimeout(timer);
                controller.abort();
            };
        },
        [
            clusterInspection,
            comparisonClusterId,
            comparisonClusterInspection,
            comparisonGroupIds,
            comparisonGroupMembership,
            comparisonLocationIds,
            comparisonMinimumExhibitedItems,
            comparisonMinimumMembership,
            comparisonSelectedGenders,
            comparisonYearRange,
            explorer.selectedClusterId,
            mode,
        ],
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

    const acceptsSharedArtistFilters =
        useCallback(
            (
                artist:
                    ArtistEmbedding2D
                    | ArtistEmbedding3D,
            ) => {
                if (
                    !artist.is_noise
                    && artist.membership_probability
                    < explorer.minimumMembership
                ) {
                    return false;
                }

                if (
                    explorer.selectedGenders.length
                    && !explorer.selectedGenders.includes(
                        normalizedGender(artist.gender),
                    )
                ) {
                    return false;
                }

                if (
                    artist.exhibited_item_count
                    < explorer.minimumExhibitedItems
                ) {
                    return false;
                }

                if (
                    allowedArtistIds
                    && !allowedArtistIds.has(artist.id)
                ) {
                    return false;
                }

                if (explorer.yearRange) {
                    if (
                        artist.birth_year === null
                        || artist.birth_year < explorer.yearRange[0]
                        || artist.birth_year > explorer.yearRange[1]
                    ) {
                        return false;
                    }
                }

                return true;
            },
            [
                allowedArtistIds,
                explorer.minimumExhibitedItems,
                explorer.minimumMembership,
                explorer.selectedGenders,
                explorer.yearRange,
            ],
        );

    const acceptsOverviewArtist =
        useCallback(
            (
                artist:
                    ArtistEmbedding2D
                    | ArtistEmbedding3D,
            ) => {
                if (!acceptsSharedArtistFilters(artist)) {
                    return false;
                }

                if (
                    explorer.clusterStatus === "clustered"
                    && artist.is_noise
                ) {
                    return false;
                }

                if (
                    explorer.clusterStatus === "noise"
                    && !artist.is_noise
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

                return true;
            },
            [
                acceptsSharedArtistFilters,
                explorer.clusterStatus,
                explorer.selectedClusters,
            ],
        );

    const sharedFilteredData2D =
        useMemo(
            () =>
                data2D.filter(
                    acceptsSharedArtistFilters,
                ),
            [
                acceptsSharedArtistFilters,
                data2D,
            ],
        );

    const sharedFilteredData3D =
        useMemo(
            () =>
                data3D?.filter(
                    acceptsSharedArtistFilters,
                )
                ?? null,
            [
                acceptsSharedArtistFilters,
                data3D,
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

    const artistCandidateFiltersActive =
        explorer.clusterStatus !== "all"
        || explorer.selectedClusters.length > 0
        || explorer.selectedGenders.length > 0
        || explorer.minimumExhibitedItems > 0
        || explorer.minimumMembership > 0
        || explorer.yearRange !== null
        || explorer.selectedGroupIds.length > 0
        || explorer.groupMembership !== "all"
        || explorer.selectedLocationIds.length > 0;

    const overviewArtistIds =
        useMemo(
            () =>
                new Set(
                    overviewData2D.map(
                        (artist) => artist.id,
                    ),
                ),
            [overviewData2D],
        );

    const activeClusterInspection =
        mode === "cluster"
            ? (filteredClusterInspection ?? clusterInspection)
            : clusterInspection;

    const filteredClusterArtists =
        useMemo(
            () => activeClusterInspection?.artists ?? [],
            [activeClusterInspection],
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

    useEffect(
        () => {
            const selectedArtistId = explorer.selectedArtistId;

            if (!selectedArtistId) {
                return;
            }

            if (
                mode === "overview"
                && !overviewArtistIds.has(selectedArtistId)
            ) {
                explorer.setSelectedArtistId(null);
                return;
            }

            if (
                mode === "cluster"
                && clusterInspection
                && !filteredClusterArtistIds.has(selectedArtistId)
            ) {
                explorer.setSelectedArtistId(null);
            }
        },
        [
            clusterInspection,
            explorer,
            filteredClusterArtistIds,
            mode,
            overviewArtistIds,
        ],
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

                if (mode === "cluster-compare") {
                    const inspectionA =
                        filteredComparisonInspectionA
                        ?? clusterInspection;
                    const inspectionB =
                        filteredComparisonInspectionB
                        ?? comparisonClusterInspection;

                    const artistIdsA = new Set(
                        inspectionA?.artists.map((artist) => artist.id) ?? [],
                    );
                    const artistIdsB = new Set(
                        inspectionB?.artists.map((artist) => artist.id) ?? [],
                    );

                    return sharedFilteredData2D.filter((artist) => {
                        if (
                            selectedClusterId !== null
                            && artist.cluster === selectedClusterId
                        ) {
                            return artistIdsA.has(artist.id);
                        }

                        if (
                            comparisonClusterId !== null
                            && artist.cluster === comparisonClusterId
                        ) {
                            return artistIdsB.has(artist.id);
                        }

                        return true;
                    });
                }

                if (mode === "compare") {
                    if (
                        comparisonShowMapContext
                        || !comparisonArtistId
                        || !explorer.selectedArtistId
                    ) {
                        return overviewData2D;
                    }

                    return overviewData2D.filter(
                        (artist) =>
                            artist.id === explorer.selectedArtistId
                            || artist.id === comparisonArtistId,
                    );
                }

                if (mode === "artist") {
                    if (
                        selectedClusterId === null
                        || showSurroundingClusters
                    ) {
                        return overviewData2D;
                    }

                    return overviewData2D.filter(
                        (artist) =>
                            artist.cluster === selectedClusterId,
                    );
                }

                if (
                    selectedClusterId === null
                    || !clusterInspection
                ) {
                    return overviewData2D;
                }

                if (!showSurroundingClusters) {
                    return sharedFilteredData2D.filter(
                        (artist) =>
                            artist.cluster === selectedClusterId
                            && filteredClusterArtistIds.has(artist.id),
                    );
                }

                return sharedFilteredData2D.filter(
                    (artist) =>
                        artist.cluster !== selectedClusterId
                        || filteredClusterArtistIds.has(artist.id),
                );
            },
            [
                clusterInspection,
                comparisonArtistId,
                comparisonClusterId,
                comparisonClusterInspection,
                comparisonShowMapContext,
                filteredComparisonInspectionA,
                filteredComparisonInspectionB,
                data2D,
                explorer.selectedArtistId,
                filteredClusterArtistIds,
                mode,
                overviewData2D,
                sharedFilteredData2D,
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

                if (mode === "cluster-compare") {
                    const inspectionA =
                        filteredComparisonInspectionA
                        ?? clusterInspection;
                    const inspectionB =
                        filteredComparisonInspectionB
                        ?? comparisonClusterInspection;

                    const artistIdsA = new Set(
                        inspectionA?.artists.map((artist) => artist.id) ?? [],
                    );
                    const artistIdsB = new Set(
                        inspectionB?.artists.map((artist) => artist.id) ?? [],
                    );

                    return (sharedFilteredData3D ?? []).filter((artist) => {
                        if (
                            selectedClusterId !== null
                            && artist.cluster === selectedClusterId
                        ) {
                            return artistIdsA.has(artist.id);
                        }

                        if (
                            comparisonClusterId !== null
                            && artist.cluster === comparisonClusterId
                        ) {
                            return artistIdsB.has(artist.id);
                        }

                        return true;
                    });
                }

                if (mode === "compare") {
                    if (
                        comparisonShowMapContext
                        || !comparisonArtistId
                        || !explorer.selectedArtistId
                    ) {
                        return overviewData3D;
                    }

                    return (overviewData3D ?? []).filter(
                        (artist) =>
                            artist.id === explorer.selectedArtistId
                            || artist.id === comparisonArtistId,
                    );
                }

                if (mode === "artist") {
                    if (
                        selectedClusterId === null
                        || showSurroundingClusters
                    ) {
                        return overviewData3D;
                    }

                    return (overviewData3D ?? []).filter(
                        (artist) =>
                            artist.cluster === selectedClusterId,
                    );
                }

                if (
                    selectedClusterId === null
                    || !clusterInspection
                ) {
                    return overviewData3D;
                }

                if (!showSurroundingClusters) {
                    return (sharedFilteredData3D ?? []).filter(
                        (artist) =>
                            artist.cluster === selectedClusterId
                            && filteredClusterArtistIds.has(artist.id),
                    );
                }

                return (sharedFilteredData3D ?? []).filter(
                    (artist) =>
                        artist.cluster !== selectedClusterId
                        || filteredClusterArtistIds.has(artist.id),
                );
            },
            [
                clusterInspection,
                comparisonArtistId,
                comparisonClusterId,
                comparisonClusterInspection,
                comparisonShowMapContext,
                filteredComparisonInspectionA,
                filteredComparisonInspectionB,
                data3D,
                explorer.selectedArtistId,
                filteredClusterArtistIds,
                mode,
                overviewData3D,
                sharedFilteredData3D,
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
                if (mode === "cluster-compare") {
                    return focusedData2D.filter(
                        (artist) =>
                            artist.cluster === selectedClusterId
                            || (
                                comparisonClusterId !== null
                                && artist.cluster === comparisonClusterId
                            ),
                    );
                }

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
                comparisonClusterId,
                comparisonFocusData2D,
                focusedData2D,
                mode,
                selectedArtist,
                selectedClusterBoundary2D,
                selectedClusterId,
            ],
        );

    const mapFocusData3D =
        useMemo(
            () => {
                if (mode === "cluster-compare") {
                    return (focusedData3D ?? []).filter(
                        (artist) =>
                            artist.cluster === selectedClusterId
                            || (
                                comparisonClusterId !== null
                                && artist.cluster === comparisonClusterId
                            ),
                    );
                }

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
                focusedData3D,
                mode,
                selectedArtist,
                selectedClusterBoundary3D,
                selectedClusterId,
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

    const artistClusterById =
        useMemo(
            () =>
                new Map(
                    data2D.map(
                        (artist) => [
                            String(artist.id),
                            artist.cluster,
                        ] as const,
                    ),
                ),
            [data2D],
        );


    const filteredSimilarArtists =
        useMemo(
            () =>
                similarArtists.filter(
                    (artist) =>
                        overviewArtistIds.has(artist.id),
                ),
            [
                overviewArtistIds,
                similarArtists,
            ],
        );

    const visibleSimilarArtists =
        useMemo(
            () =>
                filteredSimilarArtists
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
                filteredSimilarArtists,
                similarArtistLimit,
                similarityThreshold,
            ],
        );

    function clearComparisonState() {
        setComparisonArtistId(null);
        setComparisonSelectionActive(false);
        setComparison(null);
        setComparisonError(null);
        setComparisonClusterId(null);
        setComparisonClusterInspection(null);
        setFilteredComparisonInspectionA(null);
        setFilteredComparisonInspectionB(null);
        setClusterComparisonError(null);
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

    function copySharedFiltersToComparison() {
        setComparisonMinimumMembership(explorer.minimumMembership);
        setComparisonYearRange(explorer.yearRange);
        setComparisonGroupIds(explorer.selectedGroupIds);
        setComparisonGroupMembership(explorer.groupMembership);
        setComparisonLocationIds(explorer.selectedLocationIds);
        setComparisonSelectedGenders(explorer.selectedGenders);
        setComparisonMinimumExhibitedItems(explorer.minimumExhibitedItems);
    }

    function resetComparisonFilters() {
        explorer.setMinimumMembership(0);
        explorer.setYearRange(null);
        explorer.setSelectedGroupIds([]);
        explorer.setGroupMembership("all");
        explorer.setSelectedLocationIds([]);
        explorer.setSelectedGenders([]);
        explorer.setMinimumExhibitedItems(0);

        setComparisonMinimumMembership(0);
        setComparisonYearRange(null);
        setComparisonGroupIds([]);
        setComparisonGroupMembership("all");
        setComparisonLocationIds([]);
        setComparisonSelectedGenders([]);
        setComparisonMinimumExhibitedItems(0);
    }


    function startClusterComparison() {
        copySharedFiltersToComparison();

        if (selectedClusterId === null) {
            return;
        }

        setComparisonArtistId(null);
        setComparisonSelectionActive(false);
        setComparison(null);
        setComparisonError(null);
        setComparisonClusterId(null);
        setComparisonClusterInspection(null);
        setClusterComparisonError(null);
        explorer.setSelectedArtistId(null);
        setMode("cluster-compare");
    }

    function changeComparisonClusterA(clusterId: number) {
        if (clusterId === comparisonClusterId) {
            return;
        }

        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(clusterId);
        setFilteredComparisonInspectionA(null);
        setMode("cluster-compare");
    }

    function changeComparisonClusterB(clusterId: number | null) {
        if (clusterId === selectedClusterId) {
            return;
        }

        setComparisonClusterId(clusterId);
        setComparisonClusterInspection(null);
        setFilteredComparisonInspectionB(null);
        setClusterComparisonError(null);
        setMode("cluster-compare");
    }

    function swapComparisonClusters() {
        if (selectedClusterId === null || comparisonClusterId === null) {
            return;
        }

        const previousA = selectedClusterId;
        explorer.setSelectedClusterId(comparisonClusterId);
        setComparisonClusterId(previousA);
        setComparisonClusterInspection(null);
        setFilteredComparisonInspectionA(null);
        setFilteredComparisonInspectionB(null);
        setClusterComparisonError(null);
    }

    function resetClusterComparison() {
        setComparisonClusterId(null);
        setComparisonClusterInspection(null);
        setFilteredComparisonInspectionB(null);
        setClusterComparisonError(null);
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
                if (mode === "cluster-compare") {
                    if (
                        artist.is_noise
                        || artist.cluster < 0
                        || artist.cluster === selectedClusterId
                    ) {
                        return;
                    }

                    setComparisonClusterId(artist.cluster);
                    setComparisonClusterInspection(null);
                    setFilteredComparisonInspectionB(null);
                    setClusterComparisonError(null);
                    explorer.setSelectedArtistId(null);
                    return;
                }

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
                selectedClusterId,
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
        explorer.setMinimumMembership(0);
        explorer.setYearRange(null);
        explorer.setSelectedGroupIds([]);
        explorer.setGroupMembership("all");
        explorer.setSelectedLocationIds([]);
        explorer.setSelectedGenders([]);
        explorer.setMinimumExhibitedItems(0);

        setClusterMinimumMembership(0);
        setClusterYearRange(null);
        setClusterGroupIds([]);
        setClusterGroupMembership("all");
        setClusterLocationIds([]);
        setClusterSelectedGenders([]);
        setClusterMinimumExhibitedItems(0);
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

    function resetAll() {
        explorer.resetFilters();
        explorer.setSelectedArtistId(null);
        explorer.setSelectedClusterId(null);
        explorer.setViewMode("2d");

        clearComparisonState();
        setMode("overview");
        setAllowedArtistIds(null);

        setClusterMinimumMembership(0);
        setClusterYearRange(null);
        setClusterGroupIds([]);
        setClusterGroupMembership("all");
        setClusterLocationIds([]);
        setClusterSelectedGenders([]);
        setClusterMinimumExhibitedItems(0);
        setShowSurroundingClusters(true);

        setSimilarityThreshold(0.7);
        setSimilarArtistLimit(10);
        setEgoDepth(2);
        setSelectedNodeTypes([]);
        setSelectedRelationshipTypes([]);
        setTimelineBinSize(1);

        setComparisonShowMapContext(true);
        setComparisonShowEdgeLabels(true);

        setMapResetRequestKey(
            (current) =>
                current + 1,
        );

        setSearchParams(
            new URLSearchParams(),
            { replace: true },
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
        : mode === "cluster-compare"
            ? selectedClusterId
            : mode === "overview"
            && !hasSelectedArtistPreview
                ? null
                : selectedClusterId;

    const mapTitle =
        mode === "cluster-compare"
        && selectedClusterId !== null
            ? comparisonClusterId !== null
                ? `Cluster comparison · Cluster ${selectedClusterId} ↔ Cluster ${comparisonClusterId}`
                : `Cluster comparison · Cluster ${selectedClusterId}`
            : mode === "compare"
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
            || mode === "cluster-compare"
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
                comparisonClusterId={
                    comparisonClusterId
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
                onStartClusterComparison={
                    startClusterComparison
                }
                onCancelComparison={
                    cancelComparison
                }
                onSelectCluster={
                    selectCluster
                }
                onResetAll={resetAll}
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
                                searchArtists={overviewData2D}
                                options={options}
                            />
                        )
                        : mode === "cluster-compare"
                            ? (
                                <ClusterComparisonSidebar
                                    clusters={options.clusters}
                                    artists={sharedFilteredData2D}
                                    inspectionA={clusterInspection}
                                    inspectionB={comparisonClusterInspection}
                                    clusterAId={selectedClusterId}
                                    clusterBId={comparisonClusterId}
                                    visibleArtistCountA={
                                        filteredComparisonInspectionA?.artist_count
                                        ?? clusterInspection?.artist_count
                                        ?? 0
                                    }
                                    visibleArtistCountB={
                                        filteredComparisonInspectionB?.artist_count
                                        ?? comparisonClusterInspection?.artist_count
                                        ?? 0
                                    }
                                    selectedGenders={comparisonSelectedGenders}
                                    onSelectedGendersChange={(value) => { setComparisonSelectedGenders(value); explorer.setSelectedGenders(value); }}
                                    minimumExhibitedItems={comparisonMinimumExhibitedItems}
                                    onMinimumExhibitedItemsChange={(value) => { setComparisonMinimumExhibitedItems(value); explorer.setMinimumExhibitedItems(value); }}
                                    minimumMembership={comparisonMinimumMembership}
                                    onMinimumMembershipChange={(value) => { setComparisonMinimumMembership(value); explorer.setMinimumMembership(value); }}
                                    yearRange={comparisonYearRange}
                                    onYearRangeChange={(value) => { setComparisonYearRange(value); explorer.setYearRange(value); }}
                                    selectedGroupIds={comparisonGroupIds}
                                    onSelectedGroupIdsChange={(value) => { setComparisonGroupIds(value); explorer.setSelectedGroupIds(value); }}
                                    groupMembership={comparisonGroupMembership}
                                    onGroupMembershipChange={(value) => { setComparisonGroupMembership(value); explorer.setGroupMembership(value); }}
                                    selectedLocationIds={comparisonLocationIds}
                                    onSelectedLocationIdsChange={(value) => { setComparisonLocationIds(value); explorer.setSelectedLocationIds(value); }}
                                    onClusterAChange={changeComparisonClusterA}
                                    onClusterBChange={changeComparisonClusterB}
                                    onSwap={swapComparisonClusters}
                                    onResetComparison={resetClusterComparison}
                                    onResetFilters={resetComparisonFilters}
                                />
                            )
                        : mode === "compare"
                        && selectedArtist
                            ? (
                                <ComparisonSidebar
                                    artists={overviewData2D}
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
                                        artistFiltersActive={
                                            artistCandidateFiltersActive
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
                                                selectableArtists={
                                                    filteredClusterArtists
                                                }
                                                visibleArtistCount={
                                                    filteredClusterArtists.length
                                                }
                                                minimumMembership={
                                                    clusterMinimumMembership
                                                }
                                                onMinimumMembershipChange={(value) => {
                                                    setClusterMinimumMembership(value);
                                                    explorer.setMinimumMembership(value);
                                                }}
                                                yearRange={
                                                    clusterYearRange
                                                }
                                                onYearRangeChange={(value) => {
                                                    setClusterYearRange(value);
                                                    explorer.setYearRange(value);
                                                }}
                                                selectedGroupIds={
                                                    clusterGroupIds
                                                }
                                                onSelectedGroupIdsChange={(value) => {
                                                    setClusterGroupIds(value);
                                                    explorer.setSelectedGroupIds(value);
                                                }}
                                                groupMembership={
                                                    clusterGroupMembership
                                                }
                                                onGroupMembershipChange={(value) => {
                                                    setClusterGroupMembership(value);
                                                    explorer.setGroupMembership(value);
                                                }}
                                                selectedLocationIds={
                                                    clusterLocationIds
                                                }
                                                onSelectedLocationIdsChange={(value) => {
                                                    setClusterLocationIds(value);
                                                    explorer.setSelectedLocationIds(value);
                                                }}
                                                selectedGenders={
                                                    clusterSelectedGenders
                                                }
                                                onSelectedGendersChange={(value) => {
                                                    setClusterSelectedGenders(value);
                                                    explorer.setSelectedGenders(value);
                                                }}
                                                minimumExhibitedItems={
                                                    clusterMinimumExhibitedItems
                                                }
                                                onMinimumExhibitedItemsChange={(value) => {
                                                    setClusterMinimumExhibitedItems(value);
                                                    explorer.setMinimumExhibitedItems(value);
                                                }}
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
                                                searchArtists={overviewData2D}
                                                options={options}
                                            />
                                        )}
                </Panel>

                <Panel className="explorer-map-panel">
                    <EmbeddingMap
                        key={`embedding-map-${mapResetRequestKey}`}
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
                                : mode === "cluster-compare"
                                    ? focusedData2D.filter(
                                        (artist) => artist.cluster === selectedClusterId,
                                    )
                                    : selectedClusterBoundary2D
                        }
                        highlightBoundaryData3D={
                            mapHighlightClusterId === null
                                ? []
                                : mode === "cluster-compare"
                                    ? focusedData3D?.filter(
                                        (artist) => artist.cluster === selectedClusterId,
                                    ) ?? []
                                    : selectedClusterBoundary3D
                        }
                        additionalHighlightClusterIds={
                            mode === "cluster-compare"
                            && comparisonClusterId !== null
                                ? [comparisonClusterId]
                                : []
                        }
                        additionalHighlightBoundaryData2D={
                            mode === "cluster-compare"
                            && comparisonClusterId !== null
                                ? focusedData2D.filter(
                                    (artist) => artist.cluster === comparisonClusterId,
                                )
                                : []
                        }
                        additionalHighlightBoundaryData3D={
                            mode === "cluster-compare"
                            && comparisonClusterId !== null
                                ? focusedData3D?.filter(
                                    (artist) => artist.cluster === comparisonClusterId,
                                ) ?? []
                                : []
                        }
                        dimNonHighlighted={
                            mode === "cluster-compare"
                            || (
                                mode !== "overview"
                                && mode !== "compare"
                                && showSurroundingClusters
                            )
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
                        onClusterClick={
                            mode === "cluster-compare"
                                ? (clusterId) => {
                                    if (
                                        clusterId !== selectedClusterId
                                        && clusterId >= 0
                                    ) {
                                        changeComparisonClusterB(clusterId);
                                    }
                                }
                                : undefined
                        }
                        legendPriorityClusterIds={
                            [
                                selectedArtist?.cluster,
                                comparisonArtist?.cluster,
                                selectedClusterId ?? undefined,
                                comparisonClusterId ?? undefined,
                            ].filter(
                                (cluster): cluster is number =>
                                    cluster !== undefined
                                    && cluster >= 0,
                            )
                        }
                        title={mapTitle}
                        description={
                            comparisonSelectionActive
                                ? "Select a second Artist point to start the comparison."
                                : mode === "cluster-compare"
                                    ? "All clusters remain visible as context. Cluster A and Cluster B are outlined. Click an Artist in another cluster, or a cluster in the legend, to select Cluster B."
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
                        : mode === "cluster-compare"
                            ? (
                                <ClusterComparisonDetailsPanel
                                    inspectionA={
                                        filteredComparisonInspectionA
                                        ?? clusterInspection
                                    }
                                    inspectionB={
                                        filteredComparisonInspectionB
                                        ?? comparisonClusterInspection
                                    }
                                    fullArtistCountA={clusterInspection?.artist_count ?? 0}
                                    fullArtistCountB={comparisonClusterInspection?.artist_count ?? 0}
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
                                                filteredSimilarArtists.length
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
                                            exhibitedArtworks={
                                                artistInspection
                                                    ?.exhibited_artworks
                                                ?? []
                                            }
                                            exhibitedArtworksNote={
                                                artistInspection
                                                    ?.exhibited_artworks_note
                                                ?? null
                                            }
                                        />
                                    </Box>
                                )
                                : (loadingClusterInspection || loadingFilteredClusterInspection)
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
                                                        activeClusterInspection
                                                        ?? clusterInspection
                                                    }
                                                    visibleArtistCount={
                                                        filteredClusterArtists.length
                                                    }
                                                    fullArtistCount={
                                                        clusterInspection.artist_count
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
                                allowedArtistIds={
                                    overviewArtistIds
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
                        {(loadingClusterInspection || loadingFilteredClusterInspection)
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

                {mode === "cluster-compare" && (
                    <Panel
                        title="Cluster context comparison"
                        className="explorer-results-panel explorer-results-panel--comparison"
                    >
                        <ClusterComparisonWorkspace
                            inspectionA={
                                filteredComparisonInspectionA
                                ?? clusterInspection
                            }
                            inspectionB={
                                filteredComparisonInspectionB
                                ?? comparisonClusterInspection
                            }
                            fullArtistCountA={clusterInspection?.artist_count ?? 0}
                            fullArtistCountB={comparisonClusterInspection?.artist_count ?? 0}
                            loading={
                                loadingClusterComparison
                                || loadingFilteredClusterComparison
                            }
                            error={clusterComparisonError}
                        />
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
                                artistClusterById={
                                    artistClusterById
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
