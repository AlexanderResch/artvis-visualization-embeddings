import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    FormGroup,
    Slider,
    Typography,
} from "@mui/material";

import { fetchEmbeddings2D, fetchEmbeddings3D } from "../api/embeddingsApi";
import { EmbeddingPlot2D } from "../components/EmbeddingPlot2D";
import { EmbeddingPlot3D } from "../components/EmbeddingPlot3D";
import type { Embedding2D, Embedding3D } from "../types/embedding";

type ViewMode = "2d" | "3d";

export function EmbeddingsPage() {
    const [viewMode, setViewMode] = useState<ViewMode>("2d");
    const [data2d, setData2d] = useState<Embedding2D[]>([]);
    const [data3d, setData3d] = useState<Embedding3D[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [rotation, setRotation] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);

                const [embeddings2d, embeddings3d] = await Promise.all([
                    fetchEmbeddings2D(),
                    fetchEmbeddings3D(),
                ]);

                setData2d(embeddings2d);
                setData3d(embeddings3d);

                const allTypes = Array.from(
                    new Set(embeddings2d.map((item) => item.type))
                );

                setSelectedTypes(allTypes);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    const availableTypes = Array.from(new Set(data2d.map((item) => item.type)));

    const filteredData2d = data2d.filter((item) =>
        selectedTypes.includes(item.type)
    );

    const filteredData3d = data3d.filter((item) =>
        selectedTypes.includes(item.type)
    );

    function toggleType(type: string) {
        setSelectedTypes((current) =>
            current.includes(type)
                ? current.filter((item) => item !== type)
                : [...current, type]
        );
    }

    function selectOnly(type: string) {
        setSelectedTypes([type]);
    }

    function selectAll() {
        setSelectedTypes(availableTypes);
    }

    function clearAll() {
        setSelectedTypes([]);
    }

    if (loading) {
        return (
            <Box sx={{ p: 4 }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Loading embeddings...</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 4 }}>
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
                ArtVis Embedding Visualization
            </Typography>

            <Typography variant="body1" sx={{ mb: 3 }}>
                TransE embeddings projected with UMAP. The 2D view gives an overview,
                the 3D view supports rotation and spatial inspection.
            </Typography>

            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
                <Button
                    variant={viewMode === "2d" ? "contained" : "outlined"}
                    onClick={() => setViewMode("2d")}
                >
                    2D View
                </Button>

                <Button
                    variant={viewMode === "3d" ? "contained" : "outlined"}
                    onClick={() => setViewMode("3d")}
                >
                    3D View
                </Button>
            </Box>

            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    Entity Type Filter
                </Typography>

                <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
                    <Button size="small" variant="outlined" onClick={selectAll}>
                        Select all
                    </Button>

                    <Button size="small" variant="outlined" onClick={clearAll}>
                        Clear all
                    </Button>
                </Box>

                <FormGroup row>
                    {availableTypes.map((type) => (
                        <Box key={type} sx={{ display: "flex", alignItems: "center" }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={selectedTypes.includes(type)}
                                        onChange={() => toggleType(type)}
                                    />
                                }
                                label={`${type} (${
                                    data2d.filter((item) => item.type === type).length
                                })`}
                            />

                            <Button size="small" onClick={() => selectOnly(type)}>
                                Only
                            </Button>
                        </Box>
                    ))}
                </FormGroup>

                <Typography variant="body2" sx={{ mt: 1 }}>
                    Showing{" "}
                    {viewMode === "2d" ? filteredData2d.length : filteredData3d.length}{" "}
                    of {viewMode === "2d" ? data2d.length : data3d.length} entities.
                </Typography>
            </Box>

            {viewMode === "3d" && (
                <Box sx={{ mb: 3, maxWidth: 500 }}>
                    <Typography gutterBottom>Rotation: {rotation}°</Typography>
                    <Slider
                        value={rotation}
                        min={0}
                        max={360}
                        step={1}
                        onChange={(_, value) => setRotation(value as number)}
                    />
                </Box>
            )}

            <Box sx={{ border: "1px solid #ddd", borderRadius: 2, p: 2 }}>
                {viewMode === "2d" ? (
                    <EmbeddingPlot2D data={filteredData2d} />
                ) : (
                    <EmbeddingPlot3D data={filteredData3d} rotation={rotation} />
                )}
            </Box>
        </Box>
    );
}