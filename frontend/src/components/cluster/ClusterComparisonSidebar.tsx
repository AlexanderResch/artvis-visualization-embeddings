import {
    Alert,
    Box,
    Button,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";

import type {
    ClusterOption,
} from "../../types/dashboard";

export function ClusterComparisonSidebar({
                                             clusters,
                                             clusterAId,
                                             clusterBId,
                                             onClusterAChange,
                                             onClusterBChange,
                                             onSwap,
                                             onReset,
                                         }: {
    clusters: ClusterOption[];
    clusterAId: number | null;
    clusterBId: number | null;
    onClusterAChange: (clusterId: number) => void;
    onClusterBChange: (clusterId: number | null) => void;
    onSwap: () => void;
    onReset: () => void;
}) {
    const availableClusters =
        clusters
            .filter((cluster) => !cluster.is_noise)
            .sort((first, second) => first.cluster - second.cluster);

    return (
        <Box sx={{ p: 1.5 }}>
            <Typography
                variant="h6"
                sx={{ fontWeight: 700, mb: 0.5 }}
            >
                Compare clusters
            </Typography>

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.5 }}
            >
                Compare the complete populations of two computed clusters.
                The comparison uses descriptive cluster statistics and graph context.
            </Typography>

            <TextField
                select
                fullWidth
                size="small"
                label="Cluster A"
                value={clusterAId ?? ""}
                onChange={(event) =>
                    onClusterAChange(Number(event.target.value))
                }
                sx={{ mb: 1.25 }}
            >
                {availableClusters
                    .filter((cluster) => cluster.cluster !== clusterBId)
                    .map((cluster) => (
                        <MenuItem
                            key={cluster.cluster}
                            value={cluster.cluster}
                        >
                            Cluster {cluster.cluster}
                            {" · "}
                            {cluster.artist_count.toLocaleString()} Artists
                        </MenuItem>
                    ))}
            </TextField>

            <TextField
                select
                fullWidth
                size="small"
                label="Cluster B"
                value={clusterBId ?? ""}
                onChange={(event) => {
                    const value = event.target.value;
                    onClusterBChange(
                        value === "" ? null : Number(value),
                    );
                }}
            >
                <MenuItem value="">Select second cluster</MenuItem>

                {availableClusters
                    .filter((cluster) => cluster.cluster !== clusterAId)
                    .map((cluster) => (
                        <MenuItem
                            key={cluster.cluster}
                            value={cluster.cluster}
                        >
                            Cluster {cluster.cluster}
                            {" · "}
                            {cluster.artist_count.toLocaleString()} Artists
                        </MenuItem>
                    ))}
            </TextField>

            {clusterBId === null ? (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                    Select Cluster B to load the comparison.
                </Alert>
            ) : null}

            <Box
                sx={{
                    display: "flex",
                    gap: 1,
                    mt: 1.5,
                    flexWrap: "wrap",
                }}
            >
                <Button
                    variant="outlined"
                    disabled={clusterAId === null || clusterBId === null}
                    onClick={onSwap}
                >
                    Swap A / B
                </Button>

                <Button
                    variant="text"
                    disabled={clusterBId === null}
                    onClick={onReset}
                >
                    Clear B
                </Button>
            </Box>

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1.5 }}
            >
                Filters from the single-cluster view are not applied here.
                This keeps both cluster populations comparable.
            </Typography>
        </Box>
    );
}
