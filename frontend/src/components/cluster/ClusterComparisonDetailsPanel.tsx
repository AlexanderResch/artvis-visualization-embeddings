import {
    Alert,
    Box,
    Chip,
    Typography,
} from "@mui/material";

import type {
    ClusterInspection,
} from "../../types/cluster";

import {
    inlierScore,
} from "../../metrics/clusterMetrics";

import {
    clusterColor,
    clusterTextColor,
} from "../../visualization/colors";

function percentage(part: number, total: number): string {
    if (total <= 0) {
        return "0.0%";
    }

    return `${((part / total) * 100).toFixed(1)}%`;
}

function formatYear(value: number | null): string {
    return value === null ? "Unknown" : value.toFixed(0);
}

function MetricRow({
                       label,
                       valueA,
                       valueB,
                   }: {
    label: string;
    valueA: string;
    valueB: string;
}) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1fr) 100px 100px",
                gap: 1,
                alignItems: "center",
                py: 0.8,
                borderBottom: "1px solid",
                borderColor: "divider",
            }}
        >
            <Typography variant="body2" color="text.secondary">
                {label}
            </Typography>
            <Typography
                variant="body2"
                sx={{ fontWeight: 700, textAlign: "right" }}
            >
                {valueA}
            </Typography>
            <Typography
                variant="body2"
                sx={{ fontWeight: 700, textAlign: "right" }}
            >
                {valueB}
            </Typography>
        </Box>
    );
}

export function ClusterComparisonDetailsPanel({
                                                  inspectionA,
                                                  inspectionB,
                                                  fullArtistCountA,
                                                  fullArtistCountB,
                                              }: {
    inspectionA: ClusterInspection | null;
    inspectionB: ClusterInspection | null;
    fullArtistCountA: number;
    fullArtistCountB: number;
}) {
    if (!inspectionA) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info">Select Cluster A.</Alert>
            </Box>
        );
    }

    if (!inspectionB) {
        return (
            <Box sx={{ p: 2 }}>
                <Chip
                    size="small"
                    label={`Cluster A · ${inspectionA.cluster}`}
                    sx={{
                        color: clusterTextColor(inspectionA.cluster),
                        backgroundColor: clusterColor(inspectionA.cluster),
                        fontWeight: 700,
                        mb: 1.5,
                    }}
                />
                <Alert severity="info">
                    Select Cluster B to compare both clusters.
                </Alert>
            </Box>
        );
    }

    const statsA = inspectionA.statistics;
    const statsB = inspectionB.statistics;

    return (
        <Box sx={{ p: 1.5 }}>
            <Typography
                variant="h6"
                sx={{ fontWeight: 800, mb: 1 }}
            >
                Cluster comparison
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px, 1fr) 100px 100px",
                    gap: 1,
                    alignItems: "center",
                    mb: 0.5,
                }}
            >
                <Typography variant="caption" color="text.secondary">
                    Metric
                </Typography>
                {[inspectionA, inspectionB].map((inspection, index) => (
                    <Chip
                        key={inspection.cluster}
                        size="small"
                        label={`${index === 0 ? "A" : "B"} · Cluster ${inspection.cluster}`}
                        sx={{
                            color: clusterTextColor(inspection.cluster),
                            backgroundColor: clusterColor(inspection.cluster),
                            fontWeight: 700,
                        }}
                    />
                ))}
            </Box>

            <MetricRow
                label="Artists shown"
                valueA={
                    fullArtistCountA > 0
                        ? `${inspectionA.artist_count.toLocaleString()} / ${fullArtistCountA.toLocaleString()}`
                        : inspectionA.artist_count.toLocaleString()
                }
                valueB={
                    fullArtistCountB > 0
                        ? `${inspectionB.artist_count.toLocaleString()} / ${fullArtistCountB.toLocaleString()}`
                        : inspectionB.artist_count.toLocaleString()
                }
            />
            <MetricRow
                label="Mean cluster assignment strength"
                valueA={inspectionA.artist_count > 0 ? statsA.mean_membership_probability.toFixed(3) : "N/A"}
                valueB={inspectionB.artist_count > 0 ? statsB.mean_membership_probability.toFixed(3) : "N/A"}
            />
            <MetricRow
                label="Mean inlier score"
                valueA={inspectionA.artist_count > 0 ? inlierScore(statsA.mean_outlier_score).toFixed(3) : "N/A"}
                valueB={inspectionB.artist_count > 0 ? inlierScore(statsB.mean_outlier_score).toFixed(3) : "N/A"}
            />
            <MetricRow
                label="Mean similarity to cluster center"
                valueA={inspectionA.artist_count > 0 ? statsA.mean_similarity_to_centroid.toFixed(3) : "N/A"}
                valueB={inspectionB.artist_count > 0 ? statsB.mean_similarity_to_centroid.toFixed(3) : "N/A"}
            />
            <MetricRow
                label="Median birth year"
                valueA={formatYear(statsA.birth_year.median)}
                valueB={formatYear(statsB.birth_year.median)}
            />
            <MetricRow
                label="Female Artists"
                valueA={`${statsA.gender_counts.female.toLocaleString()} · ${percentage(statsA.gender_counts.female, inspectionA.artist_count)}`}
                valueB={`${statsB.gender_counts.female.toLocaleString()} · ${percentage(statsB.gender_counts.female, inspectionB.artist_count)}`}
            />
            <MetricRow
                label="Male Artists"
                valueA={`${statsA.gender_counts.male.toLocaleString()} · ${percentage(statsA.gender_counts.male, inspectionA.artist_count)}`}
                valueB={`${statsB.gender_counts.male.toLocaleString()} · ${percentage(statsB.gender_counts.male, inspectionB.artist_count)}`}
            />
            <MetricRow
                label="Artists with unknown gender"
                valueA={`${statsA.gender_counts.unknown.toLocaleString()} · ${percentage(statsA.gender_counts.unknown, inspectionA.artist_count)}`}
                valueB={`${statsB.gender_counts.unknown.toLocaleString()} · ${percentage(statsB.gender_counts.unknown, inspectionB.artist_count)}`}
            />
            <MetricRow
                label="Recorded exhibited artworks"
                valueA={statsA.exhibited_items.total.toLocaleString()}
                valueB={statsB.exhibited_items.total.toLocaleString()}
            />
            <MetricRow
                label="Median exhibited artworks per Artist"
                valueA={inspectionA.artist_count > 0 ? statsA.exhibited_items.median.toFixed(1) : "N/A"}
                valueB={inspectionB.artist_count > 0 ? statsB.exhibited_items.median.toFixed(1) : "N/A"}
            />
            <MetricRow
                label="Artists with recorded artist group"
                valueA={`${statsA.artists_with_recorded_group.toLocaleString()} · ${percentage(statsA.artists_with_recorded_group, inspectionA.artist_count)}`}
                valueB={`${statsB.artists_with_recorded_group.toLocaleString()} · ${percentage(statsB.artists_with_recorded_group, inspectionB.artist_count)}`}
            />
        </Box>
    );
}
