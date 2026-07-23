import {
    Box,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
} from "@mui/material";

import {
    useEffect,
    useMemo,
    useState,
} from "react";


import {
    fetchSimilarArtists,
} from "../../api/artistsApi";

import {
    useExplorer,
} from "../../context/ExplorerContext";

import type {
    SimilarArtist,
} from "../../types/dashboard";


const MAX_SIMILAR_ARTISTS = 50;

const DEFAULT_ROWS_PER_PAGE = 10;

const ROWS_PER_PAGE_OPTIONS = [
    5,
    10,
    25,
];


function formatNames(
    items: Array<{
        name: string;
    }>,
): string {
    if (items.length === 0) {
        return "—";
    }

    return items
        .map(
            (item) =>
                item.name,
        )
        .join(", ");
}


function getArtistLabel(
    artist: SimilarArtist,
): string {
    const displayName =
        typeof artist.display_name === "string"
            ? artist.display_name.trim()
            : "";

    if (displayName) {
        return displayName;
    }

    const entity =
        typeof artist.entity === "string"
            ? artist.entity.trim()
            : "";

    if (entity) {
        return entity;
    }

    return "Unknown Artist";
}


export function SimilarArtistsTable({
                                        selectedArtistName,
                                    }: {
    selectedArtistName?: string | null;
}) {
    const explorer =
        useExplorer();


    const [
        rows,
        setRows,
    ] = useState<
        SimilarArtist[]
    >([]);

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState<
        string | null
    >(null);

    const [
        page,
        setPage,
    ] = useState(0);

    const [
        rowsPerPage,
        setRowsPerPage,
    ] = useState(
        DEFAULT_ROWS_PER_PAGE,
    );


    useEffect(
        () => {
            setPage(0);

            if (
                !explorer.selectedArtistId
            ) {
                setRows([]);
                setError(null);

                return;
            }

            const controller =
                new AbortController();

            setLoading(true);
            setError(null);

            fetchSimilarArtists(
                explorer.selectedArtistId,
                MAX_SIMILAR_ARTISTS,
                controller.signal,
            )
                .then(
                    (artists) => {
                        setRows(
                            artists,
                        );
                    },
                )
                .catch(
                    (
                        reason: unknown,
                    ) => {
                        if (
                            controller.signal.aborted
                        ) {
                            return;
                        }

                        setError(
                            reason instanceof Error
                                ? reason.message
                                : (
                                    "Failed to load "
                                    + "similar artists"
                                ),
                        );
                    },
                )
                .finally(
                    () => {
                        if (
                            !controller.signal.aborted
                        ) {
                            setLoading(false);
                        }
                    },
                );

            return () => {
                controller.abort();
            };
        },

        [
            explorer.selectedArtistId,
        ],
    );


    const visibleRows =
        useMemo(
            () => {
                const start =
                    page
                    * rowsPerPage;

                const end =
                    start
                    + rowsPerPage;

                return rows.slice(
                    start,
                    end,
                );
            },

            [
                page,
                rows,
                rowsPerPage,
            ],
        );


    function handlePageChange(
        _event: unknown,
        newPage: number,
    ) {
        setPage(
            newPage,
        );
    }


    function handleRowsPerPageChange(
        event:
        React.ChangeEvent<
            HTMLInputElement
            | HTMLTextAreaElement
        >,
    ) {
        setRowsPerPage(
            Number(
                event.target.value,
            ),
        );

        setPage(0);
    }


    function selectArtist(
        artist: SimilarArtist,
    ) {
        explorer
            .setSelectedArtistId(
                String(
                    artist.id,
                ),
            );

        explorer
            .setSelectedClusterId(
                artist.cluster,
            );
    }


    if (
        !explorer.selectedArtistId
    ) {
        return (
            <Box
                sx={{
                    p: 3,
                    textAlign: "center",
                }}
            >
                <Typography
                    color="text.secondary"
                >
                    Select an artist on the map
                    or through the search field
                    to show the most similar
                    artists in the
                    128-dimensional embedding
                    space.
                </Typography>
            </Box>
        );
    }


    if (loading) {
        return (
            <Box
                sx={{
                    p: 3,

                    display: "flex",

                    alignItems: "center",

                    justifyContent:
                        "center",

                    gap: 1.5,
                }}
            >
                <CircularProgress
                    size={28}
                />

                <Typography
                    color="text.secondary"
                >
                    Loading similar artists…
                </Typography>
            </Box>
        );
    }


    if (error) {
        return (
            <Box
                sx={{
                    p: 2,
                }}
            >
                <Typography
                    color="error"
                >
                    {error}
                </Typography>
            </Box>
        );
    }


    return (
        <Box>
            <Box
                sx={{
                    px: 2,
                    pt: 1.5,
                    pb: 1,
                }}
            >
                <Typography
                    variant="body2"

                    color="text.secondary"
                >
                    Similar to
                    {" "}

                    <strong>
                        {
                            selectedArtistName
                            ?? explorer.selectedArtistId
                            ?? "Selected artist"
                        }
                    </strong>.

                    {" "}

                    Similarity is calculated
                    in the final
                    high-dimensional Artist
                    embedding and not from the
                    visible UMAP distance.
                </Typography>

                <Typography
                    variant="caption"

                    color="text.secondary"

                    sx={{
                        display: "block",
                        mt: 0.5,
                    }}
                >
                    Showing the
                    {" "}
                    {MAX_SIMILAR_ARTISTS}
                    {" "}
                    nearest embedding
                    neighbours.
                </Typography>
            </Box>


            <TableContainer
                sx={{
                    maxHeight: 360,
                }}
            >
                <Table
                    stickyHeader

                    size="small"

                    aria-label={
                        "Most similar artists"
                    }
                >
                    <TableHead>
                        <TableRow>
                            <TableCell>
                                Artist
                            </TableCell>

                            <TableCell
                                align="right"
                            >
                                Similarity
                            </TableCell>

                            <TableCell>
                                Cluster
                            </TableCell>

                            <TableCell>
                                Shared groups
                            </TableCell>

                            <TableCell>
                                Shared exhibitions
                            </TableCell>

                            <TableCell>
                                Shared locations
                            </TableCell>

                        </TableRow>
                    </TableHead>


                    <TableBody>
                        {
                            visibleRows.map(
                                (artist) => {
                                    const commonGroups =
                                        formatNames(
                                            artist.common_groups,
                                        );

                                    const commonExhibitions =
                                        formatNames(
                                            artist
                                                .common_exhibitions,
                                        );

                                    const commonLocations =
                                        formatNames(
                                            artist
                                                .common_locations,
                                        );

                                    return (
                                        <TableRow
                                            hover

                                            key={
                                                artist.entity
                                                || artist.id
                                            }

                                            onClick={() =>
                                                selectArtist(
                                                    artist,
                                                )
                                            }

                                            sx={{
                                                cursor: "pointer",
                                            }}
                                        >
                                            <TableCell>
                                                <Typography
                                                    variant="body2"

                                                    sx={{
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {getArtistLabel(
                                                        artist,
                                                    )}
                                                </Typography>

                                                <Typography
                                                    variant="caption"

                                                    color="text.secondary"
                                                >
                                                    {
                                                        artist.birth_year
                                                        ?? "?"
                                                    }
                                                    –
                                                    {
                                                        artist.death_year
                                                        ?? "?"
                                                    }


                                                </Typography>
                                            </TableCell>


                                            <TableCell
                                                align="right"
                                            >
                                                <Typography
                                                    variant="body2"

                                                    sx={{
                                                        fontVariantNumeric:
                                                            "tabular-nums",

                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {
                                                        artist.similarity
                                                            .toFixed(3)
                                                    }
                                                </Typography>
                                            </TableCell>


                                            <TableCell>
                                                <Chip
                                                    size="small"

                                                    variant="outlined"

                                                    label={
                                                        artist.is_noise
                                                            ? "Noise"
                                                            : (
                                                                `Cluster ${
                                                                    artist.cluster
                                                                }`
                                                            )
                                                    }
                                                />
                                            </TableCell>


                                            <TableCell
                                                title={
                                                    commonGroups
                                                }

                                                sx={{
                                                    maxWidth: 210,
                                                    overflow: "hidden",
                                                    textOverflow:
                                                        "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {commonGroups}
                                            </TableCell>


                                            <TableCell
                                                title={
                                                    commonExhibitions
                                                }

                                                sx={{
                                                    maxWidth: 240,
                                                    overflow: "hidden",
                                                    textOverflow:
                                                        "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {commonExhibitions}
                                            </TableCell>


                                            <TableCell
                                                title={
                                                    commonLocations
                                                }

                                                sx={{
                                                    maxWidth: 200,
                                                    overflow: "hidden",
                                                    textOverflow:
                                                        "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {commonLocations}
                                            </TableCell>


                                        </TableRow>
                                    );
                                },
                            )
                        }


                        {
                            visibleRows.length === 0
                            && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}

                                        align="center"
                                    >
                                        <Typography
                                            color="text.secondary"

                                            sx={{
                                                py: 2,
                                            }}
                                        >
                                            No similar artists
                                            were returned.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )
                        }
                    </TableBody>
                </Table>
            </TableContainer>


            <TablePagination
                component="div"

                count={
                    rows.length
                }

                page={
                    page
                }

                rowsPerPage={
                    rowsPerPage
                }

                rowsPerPageOptions={
                    ROWS_PER_PAGE_OPTIONS
                }

                onPageChange={
                    handlePageChange
                }

                onRowsPerPageChange={
                    handleRowsPerPageChange
                }

                labelRowsPerPage={
                    "Artists per page:"
                }

                labelDisplayedRows={({
                                         from,
                                         to,
                                         count,
                                     }) =>
                    `${from}–${to} of ${count}`
                }

                showFirstButton

                showLastButton

                sx={{
                    borderTop: "1px solid",

                    borderColor: "divider",

                    ".MuiTablePagination-toolbar":
                        {
                            minHeight: 52,
                        },
                }}
            />
        </Box>
    );
}