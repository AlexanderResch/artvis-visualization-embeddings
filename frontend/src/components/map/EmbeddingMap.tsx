import {
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Slider,
    Typography,
} from "@mui/material";

import {
    lazy,
    Suspense,
    useMemo,
    useState,
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
                                 focusData2D,
                                 focusData3D,
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
    focusData2D?: ArtistEmbedding2D[];
    focusData3D?: ArtistEmbedding3D[];
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

    const [
        pointScale,
        setPointScale,
    ] = useState(1.0);

    const [
        fitRequestKey,
        setFitRequestKey,
    ] = useState(0);

    const visibleCount =
        explorer.viewMode === "2d"
            ? data2D.length
            : data3D?.length ?? 0;

    const activeFocusCount =
        explorer.viewMode === "2d"
            ? focusData2D?.length ?? 0
            : focusData3D?.length ?? 0;

    const defaultDescription =
        highlightClusterId !== null
            ? explorer.viewMode === "2d"
                ? "The selected cluster is outlined in the stable 2D UMAP projection."
                : "The selected cluster is outlined by its current projected 3D silhouette."
            : "Click an Artist point to inspect it. Use the map controls to adjust point size and focus.";

    const interactionHint =
        useMemo(
            () =>
                explorer.viewMode === "2d"
                    ? "Drag to pan · Wheel to zoom"
                    : "Drag to rotate · Shift + drag to pan · Wheel zooms at the cursor",
            [explorer.viewMode],
        );

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
                    alignItems: {
                        xs: "stretch",
                        lg: "center",
                    },
                    justifyContent:
                        "space-between",
                    flexDirection: {
                        xs: "column",
                        lg: "row",
                    },
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
                        sx={{
                            display: "block",
                        }}
                    >
                        {visibleCount.toLocaleString()}
                        {" visible Artists · "}
                        {description
                            ?? defaultDescription}
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mt: 0.15,
                        }}
                    >
                        {interactionHint}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 1,
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            width: 138,
                            px: 0.5,
                        }}
                    >
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                display: "block",
                                mb: -0.25,
                            }}
                        >
                            Point size
                        </Typography>

                        <Slider
                            size="small"
                            min={0.6}
                            max={1.5}
                            step={0.1}
                            value={pointScale}
                            onChange={(
                                _,
                                value,
                            ) =>
                                setPointScale(
                                    value as number,
                                )
                            }
                            aria-label="Embedding point size"
                        />
                    </Box>

                    <Button
                        size="small"
                        variant="outlined"
                        disabled={
                            activeFocusCount === 0
                        }
                        onClick={() =>
                            setFitRequestKey(
                                (current) =>
                                    current + 1,
                            )
                        }
                    >
                        Fit focus
                    </Button>

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
                            focusData={
                                focusData2D
                            }
                            fitRequestKey={
                                fitRequestKey
                            }
                            pointScale={
                                pointScale
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
                                        focusData={
                                            focusData3D
                                        }
                                        fitRequestKey={
                                            fitRequestKey
                                        }
                                        pointScale={
                                            pointScale
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
