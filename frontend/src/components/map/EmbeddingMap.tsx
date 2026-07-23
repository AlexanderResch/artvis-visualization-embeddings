import {
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Typography,
} from "@mui/material";

import {
    lazy,
    Suspense,
} from "react";

import {
    useExplorer,
} from "../../context/ExplorerContext";

import type {
    ArtistEmbedding2D,
    ArtistEmbedding3D,
} from "../../types/embedding";

import {
    EmbeddingCanvas2D,
} from "./EmbeddingCanvas2D";


const EmbeddingCanvas3D =
    lazy(
        () =>
            import(
                "./EmbeddingCanvas3D"
                ),
    );


export function EmbeddingMap({
                                 data2D,
                                 data3D,
                                 loading3D,
                                 error3D = null,
                                 onRequest3D,
                                 highlightClusterId = null,
                                 highlightBoundaryData2D,
                                 highlightBoundaryData3D,
                                 dimNonHighlighted = false,
                                 comparisonArtistIds = null,
                                 dimNonCompared = false,
                                 onArtistClick,
                                 title = "Embedding cluster map",
                                 description,
                             }: {
    data2D: ArtistEmbedding2D[];
    data3D: ArtistEmbedding3D[] | null;
    loading3D: boolean;
    error3D?: string | null;
    onRequest3D: () => void;
    highlightClusterId?: number | null;
    highlightBoundaryData2D?: ArtistEmbedding2D[];
    highlightBoundaryData3D?: ArtistEmbedding3D[];
    dimNonHighlighted?: boolean;
    comparisonArtistIds?:
        [string, string] | null;
    dimNonCompared?: boolean;
    onArtistClick?: (
        artist:
            ArtistEmbedding2D
            | ArtistEmbedding3D,
    ) => void;
    title?: string;
    description?: string;
}) {
    const explorer =
        useExplorer();

    const visibleCount =
        explorer.viewMode === "2d"
            ? data2D.length
            : data3D?.length ?? 0;

    const defaultDescription =
        highlightClusterId !== null
            ? explorer.viewMode === "2d"
                ? "The selected cluster is outlined in the stable 2D UMAP projection."
                : "The selected cluster is outlined by its current projected 3D silhouette."
            : "Click an Artist point to inspect it. Use the cluster selector above to inspect a complete cluster.";

    return (
        <Box
            sx={{
                height: "100%",
                minHeight: 480,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                sx={{
                    px: 1.5,
                    py: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                        "space-between",
                    gap: 1,
                    borderBottom:
                        "1px solid",
                    borderColor:
                        "divider",
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                    }}
                >
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        {title}
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        {visibleCount.toLocaleString()}
                        {" visible Artists · "}
                        {description
                            ?? defaultDescription}
                    </Typography>
                </Box>

                <ButtonGroup
                    size="small"
                    aria-label="Embedding map dimension"
                >
                    <Button
                        variant={
                            explorer.viewMode
                            === "2d"
                                ? "contained"
                                : "outlined"
                        }
                        onClick={() =>
                            explorer
                                .setViewMode(
                                    "2d",
                                )
                        }
                    >
                        2D
                    </Button>

                    <Button
                        variant={
                            explorer.viewMode
                            === "3d"
                                ? "contained"
                                : "outlined"
                        }
                        onClick={() => {
                            onRequest3D();

                            explorer
                                .setViewMode(
                                    "3d",
                                );
                        }}
                    >
                        3D
                    </Button>
                </ButtonGroup>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    position: "relative",
                }}
            >
                {explorer.viewMode === "2d"
                    ? (
                        <EmbeddingCanvas2D
                            data={data2D}
                            highlightBoundaryData={
                                highlightBoundaryData2D
                            }
                            highlightClusterId={
                                highlightClusterId
                            }
                            dimNonHighlighted={
                                dimNonHighlighted
                            }
                            comparisonArtistIds={
                                comparisonArtistIds
                            }
                            dimNonCompared={
                                dimNonCompared
                            }
                            onArtistClick={
                                onArtistClick
                                    ? (artist) =>
                                        onArtistClick(
                                            artist,
                                        )
                                    : undefined
                            }
                        />
                    )
                    : error3D
                        ? (
                            <Box
                                sx={{
                                    p: 2,
                                }}
                            >
                                <Typography
                                    color="error"
                                    variant="body2"
                                >
                                    {error3D}
                                </Typography>
                            </Box>
                        )
                        : loading3D
                        || !data3D
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
                            : (
                                <Suspense
                                    fallback={
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
                                    }
                                >
                                    <EmbeddingCanvas3D
                                        data={data3D}
                                        highlightBoundaryData={
                                            highlightBoundaryData3D
                                        }
                                        highlightClusterId={
                                            highlightClusterId
                                        }
                                        dimNonHighlighted={
                                            dimNonHighlighted
                                        }
                                        comparisonArtistIds={
                                            comparisonArtistIds
                                        }
                                        dimNonCompared={
                                            dimNonCompared
                                        }
                                        onArtistClick={
                                            onArtistClick
                                                ? (artist) =>
                                                    onArtistClick(
                                                        artist,
                                                    )
                                                : undefined
                                        }
                                    />
                                </Suspense>
                            )}
            </Box>
        </Box>
    );
}
