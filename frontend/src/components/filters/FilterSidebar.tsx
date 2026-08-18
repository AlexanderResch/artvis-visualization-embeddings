import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Autocomplete,
    Box,
    Button,
    Chip,
    Divider,
    MenuItem,
    Slider,
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
    GenderFilterValue,
} from "../../types/embedding";

import type {
    DashboardOptions,
} from "../../types/dashboard";

import {
    clusterColor,
} from "../../visualization/colors";

import {
    matchesSearchTokens,
} from "../../utils/search";

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

    return "Unknown Artist";
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


function FilterAccordionHeader({
                                   title,
                                   optionCount,
                                   selectedCount,
                               }: {
    title: string;
    optionCount: number;
    selectedCount: number;
}) {
    return (
        <Box
            sx={{
                width: "100%",

                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",

                gap: 1,
                pr: 0.5,
            }}
        >
            <Typography
                variant="subtitle2"

                sx={{
                    fontWeight: 700,
                    minWidth: 0,
                }}
            >
                {title}
            </Typography>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    flexShrink: 0,
                }}
            >
                {selectedCount > 0 && (
                    <Chip
                        size="small"
                        color="primary"
                        label={`${selectedCount} selected`}
                    />
                )}

                <Chip
                    size="small"
                    variant="outlined"
                    label={optionCount}
                />
            </Box>
        </Box>
    );
}


function ExpandIndicator() {
    return (
        <Box
            component="span"

            sx={{
                color: "text.secondary",
                fontSize: 20,
                lineHeight: 1,
            }}
        >
            ▾
        </Box>
    );
}


const accordionStyles = {
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "8px !important",
    boxShadow: "none",
    backgroundColor: "background.paper",

    "&::before": {
        display: "none",
    },

    "& + &": {
        mt: 1,
    },

    "&.Mui-expanded": {
        margin: 0,
    },
};


const accordionSummaryStyles = {
    minHeight: 48,
    px: 1.25,

    "&.Mui-expanded": {
        minHeight: 48,
    },

    "& .MuiAccordionSummary-content": {
        my: 1,
        minWidth: 0,
    },

    "& .MuiAccordionSummary-content.Mui-expanded": {
        my: 1,
    },
};


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

    const [
        groupSearchInput,
        setGroupSearchInput,
    ] = useState("");

    const [
        locationSearchInput,
        setLocationSearchInput,
    ] = useState("");


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


    const clusterOptions =
        options.clusters.filter(
            (item) =>
                !item.is_noise,
        );

    const genderCounts =
        useMemo(
            () => {
                const counts: Record<GenderFilterValue, number> = {
                    F: 0,
                    M: 0,
                    UNKNOWN: 0,
                };

                artists.forEach((artist) => {
                    const normalized =
                        (artist.gender ?? "")
                            .trim()
                            .toUpperCase();

                    if (normalized === "F") {
                        counts.F += 1;
                    } else if (normalized === "M") {
                        counts.M += 1;
                    } else {
                        counts.UNKNOWN += 1;
                    }
                });

                return counts;
            },
            [artists],
        );

    const filteredGroupOptions =
        useMemo(
            () =>
                options.groups.filter(
                    (item) =>
                        matchesSearchTokens(
                            `${item.name} ${item.id}`,
                            groupSearchInput,
                        ),
                ),
            [
                groupSearchInput,
                options.groups,
            ],
        );


    const filteredLocationOptions =
        useMemo(
            () =>
                options.locations.filter(
                    (item) =>
                        matchesSearchTokens(
                            `${item.name} ${item.id}`,
                            locationSearchInput,
                        ),
                ),
            [
                locationSearchInput,
                options.locations,
            ],
        );

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

                                return matchesSearchTokens(
                                    `${artistName} ${artistId} ${entity}`,
                                    searchValue,
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
                                alignItems: "flex-start",
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

                                    {
                                        artist.is_noise
                                            ? "Not part of a cluster"
                                            : (
                                                `Part of Cluster ${
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
                                "Type an Artist name…"
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


            <Accordion
                disableGutters
                sx={accordionStyles}
            >
                <AccordionSummary
                    expandIcon={
                        <ExpandIndicator />
                    }

                    sx={
                        accordionSummaryStyles
                    }
                >
                    <FilterAccordionHeader
                        title="Exhibition locations"

                        optionCount={
                            options
                                .locations
                                .length
                        }

                        selectedCount={
                            explorer
                                .selectedLocationIds
                                .length
                        }
                    />
                </AccordionSummary>

                <AccordionDetails
                    sx={{
                        px: 1.25,
                        pt: 0,
                        pb: 1.25,
                    }}
                >
                    <TextField
                        fullWidth
                        size="small"
                        label="Search exhibition locations"
                        placeholder="Type a location name…"
                        value={locationSearchInput}
                        onChange={(event) =>
                            setLocationSearchInput(event.target.value)
                        }
                        sx={{ mb: 1 }}
                    />

                    <Typography
                        variant="caption"

                        color="text.secondary"

                        sx={{
                            display: "block",
                            mb: 1,
                        }}
                    >
                        Bar lengths indicate
                        how many Artists are
                        connected to each
                        location.
                    </Typography>

                    <ScentedList
                        items={
                            filteredLocationOptions.map(
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

                        maxVisibleHeight={
                            260
                        }
                    />

                    {
                        explorer
                            .selectedLocationIds
                            .length > 0
                        && (
                            <Button
                                size="small"

                                sx={{
                                    mt: 1,
                                }}

                                onClick={() =>
                                    explorer
                                        .setSelectedLocationIds(
                                            [],
                                        )
                                }
                            >
                                Clear locations
                            </Button>
                        )
                    }
                </AccordionDetails>
            </Accordion>


            <Accordion
                disableGutters
                sx={accordionStyles}
            >
                <AccordionSummary
                    expandIcon={<ExpandIndicator />}
                    sx={accordionSummaryStyles}
                >
                    <FilterAccordionHeader
                        title="Artist attributes"
                        optionCount={3}
                        selectedCount={
                            explorer.selectedGenders.length
                            + (explorer.minimumExhibitedItems > 0 ? 1 : 0)
                        }
                    />
                </AccordionSummary>

                <AccordionDetails
                    sx={{ px: 1.25, pt: 0, pb: 1.25 }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 0.75 }}
                    >
                        Gender
                    </Typography>

                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.75,
                            mb: 1.5,
                        }}
                    >
                        {[
                            ["F", "Female"],
                            ["M", "Male"],
                            ["UNKNOWN", "Unknown"],
                        ].map(([value, label]) => (
                            <Chip
                                key={value}
                                size="small"
                                clickable
                                color={
                                    explorer.selectedGenders.includes(
                                        value as GenderFilterValue,
                                    )
                                        ? "primary"
                                        : "default"
                                }
                                variant={
                                    explorer.selectedGenders.includes(
                                        value as GenderFilterValue,
                                    )
                                        ? "filled"
                                        : "outlined"
                                }
                                label={`${label} (${
                                    genderCounts[value as GenderFilterValue]
                                        .toLocaleString()
                                })`}
                                onClick={() =>
                                    explorer.setSelectedGenders((current) =>
                                        toggle(
                                            current,
                                            value as GenderFilterValue,
                                        ),
                                    )
                                }
                            />
                        ))}
                    </Box>

                    <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Minimum exhibited artworks"
                        value={explorer.minimumExhibitedItems}
                        inputProps={{ min: 0, step: 1 }}
                        onChange={(event) =>
                            explorer.setMinimumExhibitedItems(
                                Math.max(
                                    0,
                                    Math.floor(
                                        Number(event.target.value) || 0,
                                    ),
                                ),
                            )
                        }
                        helperText="Counts recorded exhibition catalogue entries for each Artist."
                    />
                </AccordionDetails>
            </Accordion>


            <Accordion
                disableGutters
                sx={accordionStyles}
            >
                <AccordionSummary
                    expandIcon={
                        <ExpandIndicator />
                    }

                    sx={
                        accordionSummaryStyles
                    }
                >
                    <FilterAccordionHeader
                        title="Cluster assignment"

                        optionCount={
                            clusterOptions.length
                        }

                        selectedCount={
                            explorer
                                .selectedClusters
                                .length
                        }
                    />
                </AccordionSummary>

                <AccordionDetails
                    sx={{
                        px: 1.25,
                        pt: 0,
                        pb: 1.25,
                    }}
                >
                    <Typography
                        variant="caption"

                        color="text.secondary"

                        sx={{
                            display: "block",
                            mb: 1,
                        }}
                    >
                        Bar lengths indicate
                        the number of Artists
                        assigned to each
                        computed cluster.
                    </Typography>

                    <ScentedList
                        items={
                            clusterOptions.map(
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
                                        clusterColor(
                                            item.cluster,
                                        ),
                                }),
                            )
                        }

                        selectedIds={
                            explorer
                                .selectedClusters
                                .map(String)
                        }

                        onToggle={(id) => {
                            explorer.setClusterStatus("clustered");
                            explorer.setSelectedClusters(
                                (current) =>
                                    toggle(
                                        current,
                                        Number(id),
                                    ),
                            );
                        }}

                        maxVisibleHeight={
                            260
                        }
                    />


                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Cluster status"
                        value={explorer.clusterStatus}
                        onChange={(event) => {
                            const nextStatus =
                                event.target.value as
                                    | "all"
                                    | "clustered"
                                    | "noise";

                            explorer.setClusterStatus(nextStatus);

                            if (nextStatus === "noise") {
                                explorer.setSelectedClusters([]);
                                explorer.setMinimumMembership(0);
                            }
                        }}
                        sx={{ mt: 1 }}
                    >
                        <MenuItem value="all">All Artists</MenuItem>
                        <MenuItem value="clustered">Part of a cluster</MenuItem>
                        <MenuItem value="noise">
                            Not part of a cluster (Noise)
                            {" · "}
                            {options.overview.noise_count.toLocaleString()}
                        </MenuItem>
                    </TextField>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mt: 1,
                        }}
                    >
                        Minimum cluster assignment strength: {
                            explorer.minimumMembership.toFixed(2)
                        }
                    </Typography>

                    <Slider
                        size="small"
                        min={0}
                        max={1}
                        step={0.05}
                        value={explorer.minimumMembership}
                        disabled={explorer.clusterStatus === "noise"}
                        onChange={(_, value) =>
                            explorer.setMinimumMembership(
                                value as number,
                            )
                        }
                    />

                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            flexWrap: "wrap",
                        }}
                    >
                        {explorer.selectedClusters.length > 0 && (
                            <Button
                                size="small"
                                onClick={() =>
                                    explorer.setSelectedClusters([])
                                }
                            >
                                Clear clusters
                            </Button>
                        )}

                        {explorer.minimumMembership > 0 && (
                            <Button
                                size="small"
                                onClick={() =>
                                    explorer.setMinimumMembership(0)
                                }
                            >
                                Reset assignment strength
                            </Button>
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>


            <Accordion
                disableGutters
                sx={accordionStyles}
            >
                <AccordionSummary
                    expandIcon={
                        <ExpandIndicator />
                    }

                    sx={
                        accordionSummaryStyles
                    }
                >
                    <FilterAccordionHeader
                        title={
                            "Artist groups"
                        }

                        optionCount={
                            options.groups.length
                        }

                        selectedCount={
                            explorer.selectedGroupIds.length
                            + (
                                explorer.groupMembership !== "all"
                                    ? 1
                                    : 0
                            )
                        }
                    />
                </AccordionSummary>

                <AccordionDetails
                    sx={{
                        px: 1.25,
                        pt: 0,
                        pb: 1.25,
                    }}
                >
                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Artist group status"
                        value={explorer.groupMembership}
                        onChange={(event) => {
                            const nextStatus = event.target.value as
                                | "all"
                                | "member"
                                | "not-member";

                            explorer.setGroupMembership(nextStatus);

                            if (nextStatus === "not-member") {
                                explorer.setSelectedGroupIds([]);
                            }
                        }}
                        sx={{ mb: 1.25 }}
                    >
                        <MenuItem value="all">All Artists</MenuItem>
                        <MenuItem value="member">Member of a Group</MenuItem>
                        <MenuItem value="not-member">Not Member of a Group</MenuItem>
                    </TextField>

                    {explorer.groupMembership !== "not-member" && (
                        <>
                            <TextField
                                fullWidth
                                size="small"
                                label="Search Artist groups"
                                placeholder="Type a Group name…"
                                value={groupSearchInput}
                                onChange={(event) =>
                                    setGroupSearchInput(event.target.value)
                                }
                                sx={{ mb: 1 }}
                            />

                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    display: "block",
                                    mb: 1,
                                }}
                            >
                                Bar lengths indicate how many Artists are member of each Artist group.
                            </Typography>

                            <ScentedList
                                items={
                                    filteredGroupOptions.map(
                                        (item) => ({
                                            id: item.id,
                                            label: item.name,
                                            count: item.artist_count,
                                        }),
                                    )
                                }
                                selectedIds={explorer.selectedGroupIds}
                                onToggle={(id) => {
                                    explorer.setGroupMembership("member");
                                    explorer.setSelectedGroupIds(
                                        (current) =>
                                            toggle(current, id),
                                    );
                                }}
                                maxVisibleHeight={260}
                            />
                        </>
                    )}

                    {
                        explorer
                            .selectedGroupIds
                            .length > 0
                        && (
                            <Button
                                size="small"

                                sx={{
                                    mt: 1,
                                }}

                                onClick={() =>
                                    explorer
                                        .setSelectedGroupIds(
                                            [],
                                        )
                                }
                            >
                                Clear groups
                            </Button>
                        )
                    }
                </AccordionDetails>
            </Accordion>


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
                Reset all filters
            </Button>
        </Box>
    );
}