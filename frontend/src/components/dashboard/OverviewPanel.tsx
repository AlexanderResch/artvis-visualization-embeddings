import {
    Box,
    Divider,
    LinearProgress,
    Typography,
} from "@mui/material";

import type {
    DashboardOverview,
} from "../../types/dashboard";


function Stat({
                  label,
                  value,
              }: {
    label: string;
    value: string;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent:
                    "space-between",
                gap: 2,
                py: 0.8,
            }}
        >
            <Typography
                variant="body2"
                color="text.secondary"
            >
                {label}
            </Typography>

            <Typography
                variant="body2"
                sx={{
                    fontWeight: 700,
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}


export function OverviewPanel({
                                  overview,
                                  visibleArtistCount,
                              }: {
    overview: DashboardOverview;
    visibleArtistCount: number;
}) {
    return (
        <Box
            sx={{
                p: 2,
            }}
        >
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 700,
                }}
                gutterBottom
            >
                Overview statistics
            </Typography>

            <Stat
                label="Artists"
                value={
                    overview.artist_count.toLocaleString()
                }
            />

            <Stat
                label="Visible Artists"
                value={
                    visibleArtistCount.toLocaleString()
                }
            />

            <Stat
                label="Computed clusters"
                value={
                    overview.cluster_count.toLocaleString()
                }
            />

            <Stat
                label="ArtVis groups"
                value={
                    overview.group_count.toLocaleString()
                }
            />

            <Stat
                label="Locations"
                value={
                    overview.location_count.toLocaleString()
                }
            />

            <Stat
                label="Birth-year range"
                value={
                    overview.birth_year_min !== null
                    && overview.birth_year_max !== null
                        ? `${overview.birth_year_min}–${overview.birth_year_max}`
                        : "Unknown"
                }
            />

            <Box
                sx={{
                    mt: 1.5,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        justifyContent:
                            "space-between",
                        mb: 0.5,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Noise Artists
                    </Typography>

                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        {(overview.noise_fraction * 100).toFixed(1)}%
                    </Typography>
                </Box>

                <LinearProgress
                    variant="determinate"
                    value={
                        overview.noise_fraction
                        * 100
                    }
                />
            </Box>

            <Divider
                sx={{
                    my: 2,
                }}
            />

            <Typography
                variant="subtitle1"
                sx={{
                    fontWeight: 700,
                }}
                gutterBottom
            >
                How to explore
            </Typography>

            <Box
                component="ol"
                sx={{
                    pl: 2.5,
                    m: 0,
                    color: "text.secondary",
                }}
            >
                <li>
                    <Typography variant="body2">
                        Zoom or pan the embedding map.
                    </Typography>
                </li>

                <li>
                    <Typography variant="body2">
                        Select a cluster from the header to change this workspace into Cluster Inspection.
                    </Typography>
                </li>

                <li>
                    <Typography variant="body2">
                        Click an Artist point or use the search field to change the same workspace into Artist Inspection.
                    </Typography>
                </li>

                <li>
                    <Typography variant="body2">
                        Use the breadcrumbs to return from an Artist to its cluster or to the overview.
                    </Typography>
                </li>

                <li>
                    <Typography variant="body2">
                        Switch between 2D and 3D without leaving the current analytical context.
                    </Typography>
                </li>
            </Box>
        </Box>
    );
}
