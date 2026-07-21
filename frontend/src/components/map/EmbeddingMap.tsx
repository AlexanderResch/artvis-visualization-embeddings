import {
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Typography
} from "@mui/material";

import {
    lazy,
    Suspense
} from "react";

import {
    useExplorer
} from "../../context/ExplorerContext";

import type {
    ArtistEmbedding2D,
    ArtistEmbedding3D
} from "../../types/embedding";

import {
    EmbeddingCanvas2D
} from "./EmbeddingCanvas2D";


const EmbeddingCanvas3D =
    lazy(
        () =>
            import(
                "./EmbeddingCanvas3D"
                )
    );


export function EmbeddingMap({
                                 data2D,
                                 data3D,
                                 loading3D,
                                 onRequest3D
                             }: {
    data2D:
        ArtistEmbedding2D[];

    data3D:
        ArtistEmbedding3D[]
        | null;

    loading3D:
        boolean;

    onRequest3D:
        () => void;
}) {
    const explorer =
        useExplorer();

    const visibleCount =
        explorer.viewMode === "2d"
            ? data2D.length
            : data3D?.length ?? 0;

    return (
        <Box
            sx={{
                height: "100%",
                minHeight: 480,

                display: "flex",
                flexDirection: "column"
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
                        "divider"
                }}
            >
                <Box>
                    <Typography
                        variant="subtitle1"

                        sx={{
                            fontWeight: 700
                        }}
                    >
                        Embedding cluster map
                    </Typography>

                    <Typography
                        variant="caption"

                        color="text.secondary"
                    >
                        {
                            visibleCount
                                .toLocaleString()
                        }
                        {" "}
                        visible artists
                        {" · "}
                        Click a point to inspect it
                    </Typography>
                </Box>

                <ButtonGroup
                    size="small"
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
                                    "2d"
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
                                    "3d"
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
                    position: "relative"
                }}
            >
                {
                    explorer.viewMode
                    === "2d"

                        ? (
                            <EmbeddingCanvas2D
                                data={data2D}
                            />
                        )

                        : (
                            loading3D
                            || !data3D
                        )

                            ? (
                                <Box
                                    sx={{
                                        height: "100%",
                                        display: "grid",
                                        placeItems: "center"
                                    }}
                                >
                                    <CircularProgress />
                                </Box>
                            )

                            : (
                                <Suspense
                                    fallback={
                                        <CircularProgress />
                                    }
                                >
                                    <EmbeddingCanvas3D
                                        data={data3D}
                                    />
                                </Suspense>
                            )
                }
            </Box>
        </Box>
    );
}