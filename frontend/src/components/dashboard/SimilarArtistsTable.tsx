import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { fetchSimilarArtists } from "../../api/artistsApi";
import { useExplorer } from "../../context/ExplorerContext";
import type { SimilarArtist } from "../../types/dashboard";

function names(items: Array<{ name: string }>): string {
    return items.length ? items.map((item) => item.name).join(", ") : "—";
}

export function SimilarArtistsTable({ selectedArtistName }: { selectedArtistName?: string }) {
    const explorer = useExplorer();
    const navigate = useNavigate();
    const [rows, setRows] = useState<SimilarArtist[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!explorer.selectedArtistId) {
            setRows([]);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetchSimilarArtists(explorer.selectedArtistId, 10, controller.signal)
            .then(setRows)
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setError(reason instanceof Error ? reason.message : "Failed to load similar artists");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [explorer.selectedArtistId]);

    if (!explorer.selectedArtistId) {
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">
                    Select an artist on the map or through search to show nearest neighbours in the
                    128-dimensional embedding space.
                </Typography>
            </Box>
        );
    }

    if (loading) {
        return (
            <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={{ px: 2, pt: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                    Similar to <strong>{selectedArtistName ?? explorer.selectedArtistId}</strong>. Similarity
                    is cosine similarity in the final high-dimensional Artist embedding, not distance in UMAP.
                </Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 310 }}>
                <Table stickyHeader size="small" aria-label="Most similar artists">
                    <TableHead>
                        <TableRow>
                            <TableCell>Artist</TableCell>
                            <TableCell align="right">Similarity</TableCell>
                            <TableCell>Cluster</TableCell>
                            <TableCell>Shared groups</TableCell>
                            <TableCell>Shared exhibitions</TableCell>
                            <TableCell>Shared locations</TableCell>
                            <TableCell align="right">Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((artist) => (
                            <TableRow
                                hover
                                key={artist.id}
                                onClick={() => {
                                    explorer.setSelectedArtistId(artist.id);
                                    explorer.setSelectedClusterId(artist.cluster);
                                }}
                                sx={{ cursor: "pointer" }}
                            >
                                <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {artist.display_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {artist.birth_year ?? "?"}–{artist.death_year ?? "?"}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">{artist.similarity.toFixed(3)}</TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        label={artist.is_noise ? "Noise" : `Cluster ${artist.cluster}`}
                                    />
                                </TableCell>
                                <TableCell title={names(artist.common_groups)}>{names(artist.common_groups)}</TableCell>
                                <TableCell title={names(artist.common_exhibitions)}>
                                    {names(artist.common_exhibitions)}
                                </TableCell>
                                <TableCell title={names(artist.common_locations)}>
                                    {names(artist.common_locations)}
                                </TableCell>
                                <TableCell align="right">
                                    <Button
                                        size="small"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            navigate(`/artists/${artist.id}`);
                                        }}
                                    >
                                        Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
}
