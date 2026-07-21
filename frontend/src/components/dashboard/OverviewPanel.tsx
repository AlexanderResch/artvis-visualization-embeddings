import { Box, Button, Divider, LinearProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { useExplorer } from "../../context/ExplorerContext";
import type { DashboardOverview } from "../../types/dashboard";

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.8 }}>
            <Typography variant="body2" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
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
    const explorer = useExplorer();
    const navigate = useNavigate();

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
                Overview statistics
            </Typography>
            <Stat label="Artists" value={overview.artist_count.toLocaleString()} />
            <Stat label="Visible artists" value={visibleArtistCount.toLocaleString()} />
            <Stat label="Computed clusters" value={overview.cluster_count.toLocaleString()} />
            <Stat label="ArtVis groups" value={overview.group_count.toLocaleString()} />
            <Stat label="Locations" value={overview.location_count.toLocaleString()} />
            <Stat
                label="Birth-year range"
                value={
                    overview.birth_year_min !== null && overview.birth_year_max !== null
                        ? `${overview.birth_year_min}–${overview.birth_year_max}`
                        : "Unknown"
                }
            />

            <Box sx={{ mt: 1.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        Noise artists
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {(overview.noise_fraction * 100).toFixed(1)}%
                    </Typography>
                </Box>
                <LinearProgress variant="determinate" value={overview.noise_fraction * 100} />
            </Box>

            <Divider sx={{ my: 2 }} />

            {explorer.selectedClusterId !== null && explorer.selectedClusterId >= 0 && (
                <Button
                    fullWidth
                    variant="contained"
                    sx={{ mb: 2 }}
                    onClick={() => navigate(`/clusters/${explorer.selectedClusterId}`)}
                >
                    Open cluster {explorer.selectedClusterId}
                </Button>
            )}

            {explorer.selectedArtistId && (
                <Button
                    fullWidth
                    variant="outlined"
                    sx={{ mb: 2 }}
                    onClick={() => navigate(`/artists/${explorer.selectedArtistId}`)}
                >
                    Open selected artist
                </Button>
            )}

            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                How to get started
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, m: 0, color: "text.secondary" }}>
                <li>
                    <Typography variant="body2">Zoom or pan the embedding map.</Typography>
                </li>
                <li>
                    <Typography variant="body2">Search for an artist or click a point.</Typography>
                </li>
                <li>
                    <Typography variant="body2">Use scented filters to focus the map.</Typography>
                </li>
                <li>
                    <Typography variant="body2">Inspect high-dimensional nearest neighbours.</Typography>
                </li>
                <li>
                    <Typography variant="body2">Open artist and cluster pages for deeper analysis.</Typography>
                </li>
            </Box>
        </Box>
    );
}
