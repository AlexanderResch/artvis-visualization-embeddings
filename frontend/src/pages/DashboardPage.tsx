import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDashboardOptions, fetchFilteredArtistIds } from "../api/dashboardApi";
import { fetchEmbeddings2D, fetchEmbeddings3D } from "../api/embeddingsApi";
import { OverviewPanel } from "../components/dashboard/OverviewPanel";
import { SimilarArtistsTable } from "../components/dashboard/SimilarArtistsTable";
import { FilterSidebar } from "../components/filters/FilterSidebar";
import { EmbeddingMap } from "../components/map/EmbeddingMap";
import { Panel } from "../components/ui/Panel";
import { useExplorer } from "../context/ExplorerContext";
import type { DashboardOptions } from "../types/dashboard";
import type { ArtistEmbedding2D, ArtistEmbedding3D } from "../types/embedding";

export function DashboardPage() {
    const explorer = useExplorer();
    const [data2D, setData2D] = useState<ArtistEmbedding2D[]>([]);
    const [data3D, setData3D] = useState<ArtistEmbedding3D[] | null>(null);
    const [options, setOptions] = useState<DashboardOptions | null>(null);
    const [allowedArtistIds, setAllowedArtistIds] = useState<Set<string> | null>(null);
    const [loading, setLoading] = useState(true);
    const [loading3D, setLoading3D] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);

        Promise.all([
            fetchEmbeddings2D(controller.signal),
            fetchDashboardOptions(controller.signal),
        ])
            .then(([map, dashboardOptions]) => {
                setData2D(map);
                setOptions(dashboardOptions);
                if (
                    explorer.yearRange === null &&
                    dashboardOptions.overview.birth_year_min !== null &&
                    dashboardOptions.overview.birth_year_max !== null
                ) {
                    explorer.setYearRange([
                        dashboardOptions.overview.birth_year_min,
                        dashboardOptions.overview.birth_year_max,
                    ]);
                }
            })
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setError(reason instanceof Error ? reason.message : "Failed to load dashboard data");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!explorer.selectedGroupIds.length && !explorer.selectedLocationIds.length) {
            setAllowedArtistIds(null);
            return;
        }

        const controller = new AbortController();
        fetchFilteredArtistIds(
            explorer.selectedGroupIds,
            explorer.selectedLocationIds,
            controller.signal,
        )
            .then((response) => setAllowedArtistIds(new Set(response.artist_ids)))
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setError(reason instanceof Error ? reason.message : "Failed to apply graph filters");
                }
            });

        return () => controller.abort();
    }, [explorer.selectedGroupIds, explorer.selectedLocationIds]);

    const request3D = useCallback(() => {
        if (data3D || loading3D) {
            return;
        }

        setLoading3D(true);
        fetchEmbeddings3D()
            .then(setData3D)
            .catch((reason: unknown) =>
                setError(reason instanceof Error ? reason.message : "Failed to load 3D map"),
            )
            .finally(() => setLoading3D(false));
    }, [data3D, loading3D]);

    const accepts = useCallback(
        (artist: ArtistEmbedding2D | ArtistEmbedding3D) => {
            if (!explorer.showNoise && artist.is_noise) {
                return false;
            }
            if (explorer.selectedClusters.length && !explorer.selectedClusters.includes(artist.cluster)) {
                return false;
            }
            if (artist.membership_probability < explorer.minimumMembership) {
                return false;
            }
            if (allowedArtistIds && !allowedArtistIds.has(artist.id)) {
                return false;
            }
            if (explorer.yearRange) {
                if (artist.birth_year === null) {
                    return false;
                }
                if (artist.birth_year < explorer.yearRange[0] || artist.birth_year > explorer.yearRange[1]) {
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

    const filtered2D = useMemo(() => data2D.filter(accepts), [accepts, data2D]);
    const filtered3D = useMemo(() => data3D?.filter(accepts) ?? null, [accepts, data3D]);
    const selectedArtist = data2D.find((artist) => artist.id === explorer.selectedArtistId);

    if (loading) {
        return (
            <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
                <Box sx={{ textAlign: "center" }}>
                    <CircularProgress />
                    <Typography sx={{ mt: 2 }}>Loading ArtVis Explorer…</Typography>
                </Box>
            </Box>
        );
    }

    if (error || !options) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error ?? "Dashboard options are missing"}</Alert>
            </Box>
        );
    }

    return (
        <Box className="dashboard-page">
            <Box component="header" className="dashboard-header">
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        ArtVis Embedding Explorer
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Explore density-based Artist clusters and their relation to the ArtVis knowledge graph.
                    </Typography>
                </Box>
            </Box>

            <Box className="dashboard-grid">
                <Panel className="filters-panel">
                    <FilterSidebar artists={data2D} options={options} />
                </Panel>

                <Panel className="map-panel">
                    <EmbeddingMap
                        data2D={filtered2D}
                        data3D={filtered3D}
                        loading3D={loading3D}
                        onRequest3D={request3D}
                    />
                </Panel>

                <Panel className="overview-panel">
                    <OverviewPanel
                        overview={options.overview}
                        visibleArtistCount={explorer.viewMode === "2d" ? filtered2D.length : filtered3D?.length ?? 0}
                    />
                </Panel>

                <Panel title="Most similar artists" className="similar-panel">
                    <SimilarArtistsTable selectedArtistName={selectedArtist?.display_name} />
                </Panel>
            </Box>
        </Box>
    );
}
