import {
    Autocomplete,
    Box,
    Button,
    Divider,
    FormControlLabel,
    Slider,
    Switch,
    TextField,
    Typography,
} from "@mui/material";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    useExplorer,
    type YearRange,
} from "../../context/ExplorerContext";

import type {
    ArtistEmbedding2D,
} from "../../types/embedding";

import type {
    DashboardOptions,
} from "../../types/dashboard";

import {
    CLUSTER_COLORS,
} from "../../visualization/colors";

import {
    ScentedList,
} from "./ScentedList";

import {
    TimeHistogram,
} from "./TimeHistogram";


const MAX_SEARCH_RESULTS = 100;


function getArtistKey(
    artist: ArtistEmbedding2D,
): string {
    const id = String(
        artist.id ?? "",
    ).trim();

    if (id) {
        return id;
    }

    const entity =
        typeof artist.entity === "string"
            ? artist.entity.trim()
            : "";

    if (entity) {
        return entity;
    }

    return String(
        artist.artist_index,
    );
}


function getArtistLabel(
    artist: ArtistEmbedding2D,
): string {
    const displayName =
        typeof artist.display_name === "string"
            ? artist.display_name.trim()
            : "";

    const invalidNames =
        new Set([
            "",
            "null",
            "none",
            "nan",
            "undefined",
        ]);

    if (
        displayName
        && !invalidNames.has(
            displayName.toLocaleLowerCase(),
        )
    ) {
        return displayName;
    }

    const entity =
        typeof artist.entity === "string"
            ? artist.entity.trim()
            : "";

    if (entity) {
        return entity;
    }

    return `Artist ${getArtistKey(
        artist,
    )}`;
}


function normalizeSearchText(
    value: string,
): string {
    return value
        .trim()
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            "",
        );
}


function isValidSearchArtist(
    artist: ArtistEmbedding2D,
): boolean {
    const label =
        normalizeSearchText(
            getArtistLabel(
                artist,
            ),
        );

    return ![
        "",
        "null",
        "none",
        "nan",
        "undefined",
    ].includes(label);
}


function formatArtistYears(
    artist: ArtistEmbedding2D,
): string {
    const birthYear =
        artist.birth_year ?? "?";

    const deathYear =
        artist.death_year ?? "?";

    return `${birthYear}–${deathYear}`;
}


function toggle<T>(
    values: T[],
    value: T,
): T[] {
    return values.includes(
        value,
    )
        ? values.filter(
            (item) =>
                item !== value,
        )
        : [
            ...values,
            value,
        ];
}


export function FilterSidebar({
                                  artists,
                                  options,
                              }: {
    artists: ArtistEmbedding2D[];
    options: DashboardOptions;
}) {
    const explorer =
        useExplorer();

    const [
        searchInput,
        setSearchInput,
    ] = useState("");

    const [
        searchOpen,
        setSearchOpen,
    ] = useState(false);


    const orderedArtists =
        useMemo(
            () => {
                const uniqueArtists =
                    new Map<
                        string,
                        ArtistEmbedding2D
                    >();

                for (
                    const artist
                    of artists
                    ) {
                    if (
                        !isValidSearchArtist(
                            artist,
                        )
                    ) {
                        continue;
                    }

                    const artistKey =
                        getArtistKey(
                            artist,
                        );

                    if (
                        !uniqueArtists.has(
                            artistKey,
                        )
                    ) {
                        uniqueArtists.set(
                            artistKey,
                            artist,
                        );
                    }
                }

                return Array.from(
                    uniqueArtists.values(),
                ).sort(
                    (
                        firstArtist,
                        secondArtist,
                    ) => {
                        const labelComparison =
                            getArtistLabel(
                                firstArtist,
                            ).localeCompare(
                                getArtistLabel(
                                    secondArtist,
                                ),
                                undefined,
                                {
                                    sensitivity: "base",
                                },
                            );

                        if (
                            labelComparison !== 0
                        ) {
                            return labelComparison;
                        }

                        return getArtistKey(
                            firstArtist,
                        ).localeCompare(
                            getArtistKey(
                                secondArtist,
                            ),
                        );
                    },
                );
            },

            [artists],
        );


    const selectedArtist =
        useMemo(
            () => {
                if (
                    explorer.selectedArtistId
                    === null
                ) {
                    return null;
                }

                return (
                    orderedArtists.find(
                        (artist) =>
                            String(
                                artist.id,
                            )
                            === String(
                                explorer.selectedArtistId,
                            ),
                    )
                    ?? null
                );
            },

            [
                explorer.selectedArtistId,
                orderedArtists,
            ],
        );


    useEffect(
        () => {
            if (selectedArtist) {
                setSearchInput(
                    getArtistLabel(
                        selectedArtist,
                    ),
                );

                return;
            }

            if (
                explorer.selectedArtistId
                === null
            ) {
                setSearchInput("");
            }
        },

        [
            explorer.selectedArtistId,
            selectedArtist,
        ],
    );


    const minimumYear =
        options
            .overview
            .birth_year_min
        ?? 1800;


    const maximumYear =
        options
            .overview
            .birth_year_max
        ?? 2000;


    const yearValue:
        YearRange =
        explorer.yearRange
        ?? [
            minimumYear,
            maximumYear,
        ];


    return (
        <Box
            sx={{
                p: 1.5,
            }}
        >
            <Typography
                variant="h6"

                sx={{
                    fontWeight: 700,
                    mb: 1.5,
                }}
            >
                Filters
            </Typography>


            <Autocomplete
                size="small"

                options={
                    orderedArtists
                }

                value={
                    selectedArtist
                }

                inputValue={
                    searchInput
                }

                open={
                    searchOpen
                    && searchInput
                        .trim()
                        .length > 0
                }

                autoHighlight

                clearOnEscape

                selectOnFocus

                handleHomeEndKeys

                blurOnSelect

                getOptionKey={
                    (artist) =>
                        getArtistKey(
                            artist,
                        )
                }

                getOptionLabel={
                    (artist) =>
                        getArtistLabel(
                            artist,
                        )
                }

                isOptionEqualToValue={
                    (
                        option,
                        value,
                    ) =>
                        getArtistKey(
                            option,
                        )
                        === getArtistKey(
                            value,
                        )
                }

                filterOptions={(
                    availableOptions,
                    state,
                ) => {
                    const searchValue =
                        normalizeSearchText(
                            state.inputValue,
                        );

                    if (
                        searchValue === ""
                    ) {
                        return [];
                    }

                    return availableOptions
                        .filter(
                            (artist) => {
                                const artistName =
                                    normalizeSearchText(
                                        getArtistLabel(
                                            artist,
                                        ),
                                    );

                                const artistId =
                                    normalizeSearchText(
                                        String(
                                            artist.id,
                                        ),
                                    );

                                const entity =
                                    normalizeSearchText(
                                        String(
                                            artist.entity
                                            ?? "",
                                        ),
                                    );

                                return (
                                    artistName.includes(
                                        searchValue,
                                    )
                                    || artistId.includes(
                                        searchValue,
                                    )
                                    || entity.includes(
                                        searchValue,
                                    )
                                );
                            },
                        )
                        .slice(
                            0,
                            MAX_SEARCH_RESULTS,
                        );
                }}

                onInputChange={(
                    _,
                    value,
                    reason,
                ) => {
                    if (
                        reason === "input"
                    ) {
                        setSearchInput(
                            value,
                        );

                        setSearchOpen(
                            value
                                .trim()
                                .length > 0,
                        );

                        return;
                    }

                    if (
                        reason === "clear"
                    ) {
                        setSearchInput("");
                        setSearchOpen(false);
                    }
                }}

                onClose={() => {
                    setSearchOpen(false);
                }}

                onChange={(
                    _,
                    artist,
                ) => {
                    setSearchOpen(false);

                    if (!artist) {
                        explorer
                            .setSelectedArtistId(
                                null,
                            );

                        explorer
                            .setSelectedClusterId(
                                null,
                            );

                        setSearchInput("");

                        return;
                    }

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

                    setSearchInput(
                        getArtistLabel(
                            artist,
                        ),
                    );
                }}

                renderOption={(
                    props,
                    artist,
                ) => {
                    const {
                        key,
                        ...optionProps
                    } = props;

                    return (
                        <Box
                            component="li"

                            key={
                                key
                                ?? getArtistKey(
                                    artist,
                                )
                            }

                            {...optionProps}

                            sx={{
                                display: "flex",

                                alignItems:
                                    "flex-start",

                                gap: 1,
                                py: 1,
                            }}
                        >
                            <Box
                                sx={{
                                    minWidth: 0,
                                    width: "100%",
                                }}
                            >
                                <Typography
                                    variant="body2"

                                    sx={{
                                        fontWeight: 600,
                                    }}

                                    noWrap
                                >
                                    {getArtistLabel(
                                        artist,
                                    )}
                                </Typography>

                                <Typography
                                    variant="caption"

                                    color="text.secondary"

                                    sx={{
                                        display: "block",
                                    }}

                                    noWrap
                                >
                                    {formatArtistYears(
                                        artist,
                                    )}

                                    {" · "}

                                    ID: {artist.id}

                                    {" · "}

                                    {
                                        artist.is_noise
                                            ? "Noise"
                                            : (
                                                `Cluster ${
                                                    artist.cluster
                                                }`
                                            )
                                    }
                                </Typography>
                            </Box>
                        </Box>
                    );
                }}

                renderInput={
                    (params) => (
                        <TextField
                            {...params}

                            label={
                                "Search artist"
                            }

                            placeholder={
                                "Type a name or ID…"
                            }

                            autoComplete="off"
                        />
                    )
                }

                noOptionsText={
                    "No artist found"
                }

                slotProps={{
                    listbox: {
                        style: {
                            maxHeight: 360,
                            overflowY: "auto",
                        },
                    },
                }}
            />


            <Typography
                variant="caption"

                color="text.secondary"

                sx={{
                    display: "block",
                    mt: 0.5,
                }}
            >
                Start typing to search.
                A maximum of
                {" "}
                {MAX_SEARCH_RESULTS}
                {" "}
                results is displayed.
            </Typography>


            <Divider
                sx={{
                    my: 2,
                }}
            />


            <Typography
                variant="subtitle2"

                sx={{
                    fontWeight: 700,
                }}

                gutterBottom
            >
                Time period
            </Typography>


            <Typography
                variant="caption"

                color="text.secondary"

                sx={{
                    display: "block",
                    mb: 0.75,
                }}
            >
                Current implementation
                filters by birth year.
            </Typography>


            <TimeHistogram
                bins={
                    options
                        .birth_year_histogram
                }

                value={
                    yearValue
                }

                minimum={
                    minimumYear
                }

                maximum={
                    maximumYear
                }

                onChange={
                    explorer.setYearRange
                }
            />


            <Divider
                sx={{
                    my: 2,
                }}
            />


            <Typography
                variant="subtitle2"

                sx={{
                    fontWeight: 700,
                }}

                gutterBottom
            >
                Locations
            </Typography>


            <ScentedList
                items={
                    options.locations.map(
                        (item) => ({
                            id: item.id,

                            label:
                            item.name,

                            count:
                            item.artist_count,
                        }),
                    )
                }

                selectedIds={
                    explorer
                        .selectedLocationIds
                }

                onToggle={
                    (id) =>
                        explorer
                            .setSelectedLocationIds(
                                (current) =>
                                    toggle(
                                        current,
                                        id,
                                    ),
                            )
                }
            />


            <Divider
                sx={{
                    my: 2,
                }}
            />


            <Box
                sx={{
                    display: "flex",

                    alignItems:
                        "center",

                    justifyContent:
                        "space-between",
                }}
            >
                <Typography
                    variant="subtitle2"

                    sx={{
                        fontWeight: 700,
                    }}
                >
                    Computed clusters
                </Typography>


                <Button
                    size="small"

                    onClick={() =>
                        explorer
                            .setSelectedClusters(
                                [],
                            )
                    }
                >
                    All
                </Button>
            </Box>


            <ScentedList
                items={
                    options.clusters
                        .filter(
                            (item) =>
                                !item.is_noise,
                        )
                        .map(
                            (item) => ({
                                id: String(
                                    item.cluster,
                                ),

                                label:
                                    `Cluster ${
                                        item.cluster
                                    }`,

                                count:
                                item.artist_count,

                                color:
                                    CLUSTER_COLORS[
                                    item.cluster
                                    % CLUSTER_COLORS
                                        .length
                                        ],
                            }),
                        )
                }

                selectedIds={
                    explorer
                        .selectedClusters
                        .map(String)
                }

                onToggle={
                    (id) =>
                        explorer
                            .setSelectedClusters(
                                (current) =>
                                    toggle(
                                        current,
                                        Number(id),
                                    ),
                            )
                }
            />


            <FormControlLabel
                control={
                    <Switch
                        size="small"

                        checked={
                            explorer.showNoise
                        }

                        onChange={
                            (event) =>
                                explorer
                                    .setShowNoise(
                                        event
                                            .target
                                            .checked,
                                    )
                        }
                    />
                }

                label={
                    `Show noise (${
                        options
                            .overview
                            .noise_count
                            .toLocaleString()
                    })`
                }
            />


            <Typography
                variant="caption"

                color="text.secondary"

                sx={{
                    display: "block",
                    mt: 1,
                }}
            >
                Minimum membership:
                {" "}
                {
                    explorer
                        .minimumMembership
                        .toFixed(2)
                }
            </Typography>


            <Slider
                size="small"

                min={0}

                max={1}

                step={0.05}

                value={
                    explorer
                        .minimumMembership
                }

                onChange={(
                    _,
                    value,
                ) =>
                    explorer
                        .setMinimumMembership(
                            value as number,
                        )
                }
            />


            <Divider
                sx={{
                    my: 2,
                }}
            />


            <Typography
                variant="subtitle2"

                sx={{
                    fontWeight: 700,
                }}

                gutterBottom
            >
                Connected ArtVis groups
            </Typography>


            <ScentedList
                items={
                    options.groups.map(
                        (item) => ({
                            id: item.id,

                            label:
                            item.name,

                            count:
                            item.artist_count,
                        }),
                    )
                }

                selectedIds={
                    explorer
                        .selectedGroupIds
                }

                onToggle={
                    (id) =>
                        explorer
                            .setSelectedGroupIds(
                                (current) =>
                                    toggle(
                                        current,
                                        id,
                                    ),
                            )
                }
            />


            <Button
                fullWidth

                variant="outlined"

                sx={{
                    mt: 2,
                }}

                onClick={
                    explorer.resetFilters
                }
            >
                Reset filters
            </Button>
        </Box>
    );
}