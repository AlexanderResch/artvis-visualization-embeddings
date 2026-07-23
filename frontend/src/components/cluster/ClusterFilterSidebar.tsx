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
    useMemo,
    useState,
} from "react";

import {
    useExplorer,
    type YearRange,
} from "../../context/ExplorerContext";

import type {
    ClusterArtist,
    ClusterInspection,
} from "../../types/cluster";

import {
    ScentedList,
} from "../filters/ScentedList";

import {
    TimeHistogram,
} from "../filters/TimeHistogram";


const MAX_SEARCH_RESULTS = 100;


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


function artistLabel(
    artist: ClusterArtist,
): string {
    const name =
        artist.display_name
            ?.trim();

    return name
        || artist.entity
        || "Unknown Artist";
}


function toggle(
    values: string[],
    value: string,
): string[] {
    return values.includes(value)
        ? values.filter(
            (item) =>
                item !== value,
        )
        : [
            ...values,
            value,
        ];
}


export function ClusterFilterSidebar({
                                         inspection,
                                         visibleArtistCount,
                                         minimumMembership,
                                         onMinimumMembershipChange,
                                         yearRange,
                                         onYearRangeChange,
                                         selectedGroupIds,
                                         onSelectedGroupIdsChange,
                                         showSurroundingClusters,
                                         onShowSurroundingClustersChange,
                                         onReset,
                                     }: {
    inspection: ClusterInspection;
    visibleArtistCount: number;
    minimumMembership: number;
    onMinimumMembershipChange:
        (value: number) => void;
    yearRange: YearRange | null;
    onYearRangeChange:
        (value: YearRange | null) => void;
    selectedGroupIds: string[];
    onSelectedGroupIdsChange:
        (value: string[]) => void;
    showSurroundingClusters: boolean;
    onShowSurroundingClustersChange:
        (value: boolean) => void;
    onReset: () => void;
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
            () =>
                [...inspection.artists]
                    .sort(
                        (
                            first,
                            second,
                        ) =>
                            artistLabel(first)
                                .localeCompare(
                                    artistLabel(second),
                                    undefined,
                                    {
                                        sensitivity: "base",
                                    },
                                ),
                    ),

            [inspection.artists],
        );

    const selectedArtist =
        useMemo(
            () =>
                explorer.selectedArtistId
                    ? orderedArtists.find(
                        (artist) =>
                            artist.id
                            === explorer
                                .selectedArtistId,
                    )
                    ?? null
                    : null,

            [
                explorer.selectedArtistId,
                orderedArtists,
            ],
        );

    const minimumYear =
        inspection.statistics
            .birth_year.minimum
        ?? 1800;

    const maximumYear =
        inspection.statistics
            .birth_year.maximum
        ?? 2000;

    const displayedYearRange:
        YearRange =
        yearRange
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
                    mb: 0.5,
                }}
            >
                Cluster filters
            </Typography>

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                    display: "block",
                    mb: 1.5,
                }}
            >
                {visibleArtistCount.toLocaleString()}
                {" of "}
                {inspection.artist_count.toLocaleString()}
                {" cluster artists visible"}
            </Typography>

            <Autocomplete
                size="small"
                options={orderedArtists}
                value={selectedArtist}
                inputValue={searchInput}
                open={
                    searchOpen
                    && searchInput.trim().length > 0
                }
                autoHighlight
                blurOnSelect
                clearOnEscape
                getOptionKey={
                    (artist) =>
                        artist.id
                }
                getOptionLabel={
                    (artist) =>
                        artistLabel(artist)
                }
                isOptionEqualToValue={
                    (option, value) =>
                        option.id === value.id
                }
                filterOptions={
                    (
                        availableOptions,
                        state,
                    ) => {
                        const query =
                            normalizeSearchText(
                                state.inputValue,
                            );

                        if (!query) {
                            return [];
                        }

                        return availableOptions
                            .filter(
                                (artist) => {
                                    const name =
                                        normalizeSearchText(
                                            artistLabel(artist),
                                        );

                                    const id =
                                        normalizeSearchText(
                                            artist.id,
                                        );

                                    return (
                                        name.includes(query)
                                        || id.includes(query)
                                    );
                                },
                            )
                            .slice(
                                0,
                                MAX_SEARCH_RESULTS,
                            );
                    }
                }
                onInputChange={
                    (
                        _,
                        value,
                        reason,
                    ) => {
                        if (reason === "input") {
                            setSearchInput(value);
                            setSearchOpen(
                                value.trim().length > 0,
                            );
                            return;
                        }

                        if (reason === "clear") {
                            setSearchInput("");
                            setSearchOpen(false);
                        }
                    }
                }
                onClose={
                    () =>
                        setSearchOpen(false)
                }
                onChange={
                    (_, artist) => {
                        setSearchOpen(false);

                        explorer
                            .setSelectedArtistId(
                                artist?.id
                                ?? null,
                            );

                        setSearchInput(
                            artist
                                ? artistLabel(artist)
                                : "",
                        );
                    }
                }
                renderOption={
                    (props, artist) => {
                        const {
                            key,
                            ...optionProps
                        } = props;

                        return (
                            <Box
                                component="li"
                                key={
                                    key
                                    ?? artist.id
                                }
                                {...optionProps}
                                sx={{
                                    display: "block",
                                    py: 0.8,
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 600,
                                    }}
                                    noWrap
                                >
                                    {artistLabel(artist)}
                                </Typography>

                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    noWrap
                                >
                                    {artist.birth_year ?? "?"}
                                    {"–"}
                                    {artist.death_year ?? "?"}
                                    {" · centroid "}
                                    {artist
                                        .similarity_to_centroid
                                        .toFixed(3)}
                                </Typography>
                            </Box>
                        );
                    }
                }
                renderInput={
                    (params) => (
                        <TextField
                            {...params}
                            label="Search in cluster"
                            placeholder="Type an Artist name…"
                            autoComplete="off"
                        />
                    )
                }
                noOptionsText="No artist found"
                slotProps={{
                    listbox: {
                        style: {
                            maxHeight: 360,
                            overflowY: "auto",
                        },
                    },
                }}
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
                Birth-year range
            </Typography>

            <TimeHistogram
                bins={
                    inspection
                        .birth_year_histogram
                }
                value={
                    displayedYearRange
                }
                minimum={minimumYear}
                maximum={maximumYear}
                onChange={
                    onYearRangeChange
                }
            />

            {yearRange && (
                <Button
                    size="small"
                    onClick={
                        () =>
                            onYearRangeChange(null)
                    }
                >
                    Clear year filter
                </Button>
            )}

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
            >
                Minimum membership
            </Typography>

            <Typography
                variant="caption"
                color="text.secondary"
            >
                {minimumMembership.toFixed(2)}
            </Typography>

            <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={minimumMembership}
                onChange={
                    (_, value) =>
                        onMinimumMembershipChange(
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
                ArtVis groups in cluster
            </Typography>

            <ScentedList
                items={
                    inspection
                        .group_composition
                        .map(
                            (group) => ({
                                id: group.id,
                                label: group.name,
                                count:
                                group.artist_count,
                            }),
                        )
                }
                selectedIds={selectedGroupIds}
                onToggle={
                    (groupId) =>
                        onSelectedGroupIdsChange(
                            toggle(
                                selectedGroupIds,
                                groupId,
                            ),
                        )
                }
                maxVisibleHeight={240}
            />

            <Divider
                sx={{
                    my: 2,
                }}
            />

            <FormControlLabel
                control={
                    <Switch
                        size="small"
                        checked={
                            showSurroundingClusters
                        }
                        onChange={
                            (event) =>
                                onShowSurroundingClustersChange(
                                    event.target.checked,
                                )
                        }
                    />
                }
                label="Show surrounding clusters"
            />

            <Button
                fullWidth
                variant="outlined"
                sx={{
                    mt: 2,
                }}
                onClick={onReset}
            >
                Reset cluster filters
            </Button>
        </Box>
    );
}
