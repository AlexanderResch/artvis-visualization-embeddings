import {
    Box,
    Chip,
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    Typography,
} from "@mui/material";

import {
    useMemo,
    useState,
} from "react";


import {
    useExplorer,
} from "../../context/ExplorerContext";

import type {
    ClusterArtist,
} from "../../types/cluster";


type SortKey =
    | "display_name"
    | "similarity_to_centroid"
    | "membership_probability"
    | "outlier_score"
    | "birth_year"
    | "exhibition_count";


type SortDirection =
    | "asc"
    | "desc";


function compareValues(
    first: ClusterArtist,
    second: ClusterArtist,
    key: SortKey,
): number {
    if (key === "display_name") {
        return first.display_name
            .localeCompare(
                second.display_name,
                undefined,
                {
                    sensitivity: "base",
                },
            );
    }

    const firstValue =
        first[key]
        ?? Number.NEGATIVE_INFINITY;

    const secondValue =
        second[key]
        ?? Number.NEGATIVE_INFINITY;

    return Number(firstValue)
        - Number(secondValue);
}


function CompactChipList({
                             values,
                         }: {
    values: Array<{
        id: string;
        name: string;
    }>;
}) {
    if (!values.length) {
        return (
            <Typography
                variant="caption"
                color="text.secondary"
            >
                —
            </Typography>
        );
    }

    const visible =
        values.slice(0, 2);

    return (
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.5,
            }}
        >
            {visible.map(
                (value) => (
                    <Chip
                        key={value.id}
                        label={value.name}
                        size="small"
                        variant="outlined"
                        sx={{
                            maxWidth: 170,
                        }}
                    />
                ),
            )}

            {values.length > 2 && (
                <Chip
                    label={`+${values.length - 2}`}
                    size="small"
                />
            )}
        </Box>
    );
}


export function ClusterArtistsTable({
                                        artists,
                                    }: {
    artists: ClusterArtist[];
}) {
    const explorer =
        useExplorer();


    const [
        sortKey,
        setSortKey,
    ] = useState<SortKey>(
        "similarity_to_centroid",
    );

    const [
        sortDirection,
        setSortDirection,
    ] = useState<SortDirection>(
        "desc",
    );

    const [
        page,
        setPage,
    ] = useState(0);

    const [
        rowsPerPage,
        setRowsPerPage,
    ] = useState(25);

    const sortedArtists =
        useMemo(
            () =>
                [...artists].sort(
                    (first, second) => {
                        const comparison =
                            compareValues(
                                first,
                                second,
                                sortKey,
                            );

                        return sortDirection
                        === "asc"
                            ? comparison
                            : -comparison;
                    },
                ),

            [
                artists,
                sortDirection,
                sortKey,
            ],
        );

    const visibleRows =
        useMemo(
            () =>
                sortedArtists.slice(
                    page * rowsPerPage,
                    page * rowsPerPage
                    + rowsPerPage,
                ),

            [
                page,
                rowsPerPage,
                sortedArtists,
            ],
        );

    function changeSort(
        nextKey: SortKey,
    ) {
        if (nextKey === sortKey) {
            setSortDirection(
                (current) =>
                    current === "asc"
                        ? "desc"
                        : "asc",
            );
        } else {
            setSortKey(nextKey);
            setSortDirection(
                nextKey === "display_name"
                    ? "asc"
                    : "desc",
            );
        }

        setPage(0);
    }

    function sortLabel(
        label: string,
        key: SortKey,
    ) {
        return (
            <TableSortLabel
                active={sortKey === key}
                direction={
                    sortKey === key
                        ? sortDirection
                        : "asc"
                }
                onClick={
                    () =>
                        changeSort(key)
                }
            >
                {label}
            </TableSortLabel>
        );
    }

    return (
        <Box>
            <TableContainer
                sx={{
                    maxHeight: 430,
                }}
            >
                <Table
                    stickyHeader
                    size="small"
                    aria-label="Artists in selected cluster"
                >
                    <TableHead>
                        <TableRow>
                            <TableCell>
                                {sortLabel(
                                    "Artist",
                                    "display_name",
                                )}
                            </TableCell>

                            <TableCell
                                sx={{
                                    minWidth: 150,
                                }}
                            >
                                {sortLabel(
                                    "Similarity to centroid",
                                    "similarity_to_centroid",
                                )}
                            </TableCell>

                            <TableCell>
                                {sortLabel(
                                    "Membership",
                                    "membership_probability",
                                )}
                            </TableCell>

                            <TableCell>
                                {sortLabel(
                                    "Outlier score",
                                    "outlier_score",
                                )}
                            </TableCell>

                            <TableCell>
                                {sortLabel(
                                    "Life years",
                                    "birth_year",
                                )}
                            </TableCell>

                            <TableCell>
                                Locations
                            </TableCell>

                            <TableCell>
                                ArtVis groups
                            </TableCell>

                            <TableCell>
                                {sortLabel(
                                    "Exhibitions",
                                    "exhibition_count",
                                )}
                            </TableCell>

                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {visibleRows.map(
                            (artist) => {
                                const selected =
                                    explorer.selectedArtistId
                                    === artist.id;

                                return (
                                    <TableRow
                                        key={artist.id}
                                        hover
                                        selected={selected}
                                        tabIndex={0}
                                        role="button"
                                        onClick={() => {
                                            explorer.setSelectedArtistId(
                                                artist.id,
                                            );
                                        }}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter"
                                                || event.key === " "
                                            ) {
                                                event.preventDefault();

                                                explorer.setSelectedArtistId(
                                                    artist.id,
                                                );
                                            }
                                        }}
                                        sx={{
                                            cursor: "pointer",

                                            "&:focus-visible": {
                                                outline: "2px solid",
                                                outlineColor: "primary.main",
                                                outlineOffset: -2,
                                            },
                                        }}
                                    >
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {artist.display_name}
                                            </Typography>

                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                ID: {artist.id}
                                            </Typography>
                                        </TableCell>

                                        <TableCell>
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "1fr auto",
                                                    alignItems: "center",
                                                    gap: 1,
                                                    minWidth: 130,
                                                }}
                                            >
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={
                                                        Math.max(
                                                            0,
                                                            Math.min(
                                                                100,
                                                                artist
                                                                    .similarity_to_centroid
                                                                * 100,
                                                            ),
                                                        )
                                                    }
                                                />

                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        fontVariantNumeric:
                                                            "tabular-nums",
                                                    }}
                                                >
                                                    {artist
                                                        .similarity_to_centroid
                                                        .toFixed(3)}
                                                </Typography>
                                            </Box>
                                        </TableCell>

                                        <TableCell>
                                            {artist
                                                .membership_probability
                                                .toFixed(3)}
                                        </TableCell>

                                        <TableCell>
                                            {artist
                                                .outlier_score
                                                .toFixed(3)}
                                        </TableCell>

                                        <TableCell>
                                            {artist.birth_year ?? "?"}
                                            {"–"}
                                            {artist.death_year ?? "?"}
                                        </TableCell>

                                        <TableCell>
                                            <CompactChipList
                                                values={artist.locations}
                                            />
                                        </TableCell>

                                        <TableCell>
                                            <CompactChipList
                                                values={artist.groups}
                                            />
                                        </TableCell>

                                        <TableCell>
                                            {artist.exhibition_count
                                                .toLocaleString()}
                                        </TableCell>

                                    </TableRow>
                                );
                            },
                        )}

                        {!visibleRows.length && (
                            <TableRow>
                                <TableCell
                                    colSpan={8}
                                    align="center"
                                >
                                    <Typography
                                        color="text.secondary"
                                        sx={{
                                            py: 3,
                                        }}
                                    >
                                        No Artists match the current filters.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component="div"
                count={artists.length}
                page={page}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[
                    25,
                    50,
                    100,
                ]}
                onPageChange={
                    (_, nextPage) =>
                        setPage(nextPage)
                }
                onRowsPerPageChange={
                    (event) => {
                        setRowsPerPage(
                            Number(
                                event.target.value,
                            ),
                        );

                        setPage(0);
                    }
                }
            />
        </Box>
    );
}
