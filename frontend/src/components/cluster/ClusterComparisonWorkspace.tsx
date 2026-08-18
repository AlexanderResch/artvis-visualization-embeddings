import {
    Alert,
    Box,
    Chip,
    LinearProgress,
    Typography,
} from "@mui/material";

import type {
    ClusterEvidenceItem,
    ClusterInspection,
    RepresentativeClusterArtist,
} from "../../types/cluster";

import {
    clusterColor,
    clusterTextColor,
} from "../../visualization/colors";


type MergedEvidence = {
    id: string;
    name: string;
    percentageA: number;
    percentageB: number;
    countA: number;
    countB: number;
};

function mergeEvidence(
    itemsA: ClusterEvidenceItem[],
    itemsB: ClusterEvidenceItem[],
): MergedEvidence[] {
    const merged = new Map<string, MergedEvidence>();

    itemsA.forEach((item) => {
        merged.set(item.id, {
            id: item.id,
            name: item.name,
            percentageA: item.percentage,
            percentageB: 0,
            countA: item.artist_count,
            countB: 0,
        });
    });

    itemsB.forEach((item) => {
        const current = merged.get(item.id);

        if (current) {
            current.percentageB = item.percentage;
            current.countB = item.artist_count;
            return;
        }

        merged.set(item.id, {
            id: item.id,
            name: item.name,
            percentageA: 0,
            percentageB: item.percentage,
            countA: 0,
            countB: item.artist_count,
        });
    });

    return [...merged.values()]
        .sort((first, second) =>
            Math.max(second.percentageA, second.percentageB)
            - Math.max(first.percentageA, first.percentageB),
        )
        .slice(0, 12);
}

function EvidenceComparison({
                                title,
                                description,
                                itemsA,
                                itemsB,
                                clusterA,
                                clusterB,
                            }: {
    title: string;
    description: string;
    itemsA: ClusterEvidenceItem[];
    itemsB: ClusterEvidenceItem[];
    clusterA: number;
    clusterB: number;
}) {
    const items = mergeEvidence(itemsA, itemsB);

    return (
        <Box
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
            }}
        >
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {title}
            </Typography>
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.25 }}
            >
                {description}
            </Typography>

            {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No recorded data for either cluster.
                </Typography>
            ) : items.map((item) => (
                <Box
                    key={item.id}
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "minmax(150px, 1fr) minmax(110px, 0.7fr) minmax(110px, 0.7fr) 72px",
                        gap: 1,
                        alignItems: "center",
                        py: 0.7,
                        borderTop: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Typography variant="body2" noWrap title={item.name}>
                        {item.name}
                    </Typography>

                    <Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, item.percentageA)}
                            sx={{
                                "& .MuiLinearProgress-bar": {
                                    backgroundColor: clusterColor(clusterA),
                                },
                            }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            A · {item.countA.toLocaleString()} · {item.percentageA.toFixed(1)}%
                        </Typography>
                    </Box>

                    <Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min(100, item.percentageB)}
                            sx={{
                                "& .MuiLinearProgress-bar": {
                                    backgroundColor: clusterColor(clusterB),
                                },
                            }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            B · {item.countB.toLocaleString()} · {item.percentageB.toFixed(1)}%
                        </Typography>
                    </Box>

                    <Typography
                        variant="caption"
                        sx={{ textAlign: "right", fontWeight: 700 }}
                        title="Difference in percentage points, A minus B"
                    >
                        {(item.percentageA - item.percentageB) >= 0 ? "+" : ""}
                        {(item.percentageA - item.percentageB).toFixed(1)} pp
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}

function RepresentativeList({
                                title,
                                cluster,
                                artists,
                            }: {
    title: string;
    cluster: number;
    artists: RepresentativeClusterArtist[];
}) {
    return (
        <Box
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Chip
                    size="small"
                    label={title}
                    sx={{
                        color: clusterTextColor(cluster),
                        backgroundColor: clusterColor(cluster),
                        fontWeight: 700,
                    }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Representative Artists
                </Typography>
            </Box>

            {artists.slice(0, 8).map((artist) => (
                <Box
                    key={artist.id}
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 1,
                        py: 0.65,
                        borderTop: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Typography variant="body2" noWrap>
                        {artist.display_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        center similarity {artist.similarity_to_centroid.toFixed(3)} · assignment strength {artist.membership_probability.toFixed(3)}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}

export function ClusterComparisonWorkspace({
                                               inspectionA,
                                               inspectionB,
                                               fullArtistCountA,
                                               fullArtistCountB,
                                               loading,
                                               error,
                                           }: {
    inspectionA: ClusterInspection | null;
    inspectionB: ClusterInspection | null;
    fullArtistCountA: number;
    fullArtistCountB: number;
    loading: boolean;
    error: string | null;
}) {
    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (loading) {
        return <Alert severity="info">Loading Cluster B…</Alert>;
    }

    if (!inspectionA || !inspectionB) {
        return <Alert severity="info">Select two clusters to compare them.</Alert>;
    }

    return (
        <Box sx={{ display: "grid", gap: 1.5, p: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
                Comparison based on the currently filtered Artists: Cluster A shows
                {` ${inspectionA.artist_count.toLocaleString()} of ${(fullArtistCountA || inspectionA.artist_count).toLocaleString()} Artists`}
                {" and Cluster B shows "}
                {`${inspectionB.artist_count.toLocaleString()} of ${(fullArtistCountB || inspectionB.artist_count).toLocaleString()} Artists.`}
                {" A positive difference means the category is more frequent in Cluster A."}
            </Typography>

            <EvidenceComparison
                title="Artist groups"
                description="Artist group connections that occur most often across the two clusters."
                itemsA={inspectionA.group_composition}
                itemsB={inspectionB.group_composition}
                clusterA={inspectionA.cluster}
                clusterB={inspectionB.cluster}
            />

            <EvidenceComparison
                title="Exhibition locations"
                description="Top recorded exhibition locations returned for each cluster."
                itemsA={inspectionA.explanation.top_locations}
                itemsB={inspectionB.explanation.top_locations}
                clusterA={inspectionA.cluster}
                clusterB={inspectionB.cluster}
            />

            <EvidenceComparison
                title="Exhibitions"
                description="Exhibitions with the largest share of Artists within each cluster."
                itemsA={inspectionA.explanation.top_exhibitions}
                itemsB={inspectionB.explanation.top_exhibitions}
                clusterA={inspectionA.cluster}
                clusterB={inspectionB.cluster}
            />

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                    gap: 1.5,
                }}
            >
                <RepresentativeList
                    title={`A · Cluster ${inspectionA.cluster}`}
                    cluster={inspectionA.cluster}
                    artists={inspectionA.explanation.representative_artists}
                />
                <RepresentativeList
                    title={`B · Cluster ${inspectionB.cluster}`}
                    cluster={inspectionB.cluster}
                    artists={inspectionB.explanation.representative_artists}
                />
            </Box>

            <Typography variant="caption" color="text.secondary">
                The HDBSCAN outlier score is shown directly. Lower values indicate
                a more typical position within the assigned cluster, while higher
                values indicate a more outlier-like position.
            </Typography>
        </Box>
    );
}
