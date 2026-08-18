import {
    Autocomplete,
    Box,
    Button,
    Chip,
    Divider,
    FormControlLabel,
    MenuItem,
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
import type {
    GenderFilterValue,
    GroupMembershipFilter,
} from "../../types/embedding";

import {
    ScentedList,
} from "../filters/ScentedList";

import {
    TimeHistogram,
} from "../filters/TimeHistogram";

import {
    matchesSearchTokens,
} from "../../utils/search";


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


function toggleGender(
    values: GenderFilterValue[],
    value: GenderFilterValue,
): GenderFilterValue[] {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}


export function ClusterFilterSidebar({
                                         inspection,
                                         selectableArtists,
                                         visibleArtistCount,
                                         minimumMembership,
                                         onMinimumMembershipChange,
                                         yearRange,
                                         onYearRangeChange,
                                         selectedGroupIds,
                                         onSelectedGroupIdsChange,
                                         groupMembership,
                                         onGroupMembershipChange,
                                         selectedLocationIds,
                                         onSelectedLocationIdsChange,
                                         selectedGenders,
                                         onSelectedGendersChange,
                                         minimumExhibitedItems,
                                         onMinimumExhibitedItemsChange,
                                         showSurroundingClusters,
                                         onShowSurroundingClustersChange,
                                         onReset,
                                     }: {
    inspection: ClusterInspection;
    selectableArtists?: ClusterArtist[];
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
    groupMembership: GroupMembershipFilter;
    onGroupMembershipChange:
        (value: GroupMembershipFilter) => void;
    selectedLocationIds: string[];
    onSelectedLocationIdsChange:
        (value: string[]) => void;
    selectedGenders: GenderFilterValue[];
    onSelectedGendersChange:
        (value: GenderFilterValue[]) => void;
    minimumExhibitedItems: number;
    onMinimumExhibitedItemsChange:
        (value: number) => void;
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
            () =>
                [...(selectableArtists ?? inspection.artists)]
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

            [inspection.artists, selectableArtists],
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

    const baseMinimumYear =
        inspection.statistics
            .birth_year.minimum
        ?? 1800;

    const baseMaximumYear =
        inspection.statistics
            .birth_year.maximum
        ?? 2000;

    const minimumYear = Math.min(
        baseMinimumYear,
        yearRange?.[0] ?? baseMinimumYear,
    );

    const maximumYear = Math.max(
        baseMaximumYear,
        yearRange?.[1] ?? baseMaximumYear,
    );

    const displayedYearRange:
        YearRange =
        yearRange
        ?? [
            minimumYear,
            maximumYear,
        ];

    const filteredGroupComposition =
        useMemo(
            () =>
                inspection.group_composition.filter(
                    (group) =>
                        matchesSearchTokens(
                            `${group.name} ${group.id}`,
                            groupSearchInput,
                        ),
                ),
            [
                groupSearchInput,
                inspection.group_composition,
            ],
        );

    const hasLocationOptions =
        inspection.location_composition.length > 0;

    const locationOptions =
        inspection.location_composition
            .filter((location) =>
                matchesSearchTokens(
                    `${location.name} ${location.id}`,
                    locationSearchInput,
                ),
            )
            .map((location) => ({
                id: location.id,
                label: location.name,
                count: location.artist_count,
            }));

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

                                    return matchesSearchTokens(
                                        `${name} ${id}`,
                                        query,
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
                                    {" · cluster center "}
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
                sx={{ fontWeight: 700, mb: 0.75 }}
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
                    ["F", "Female", inspection.statistics.gender_counts.female],
                    ["M", "Male", inspection.statistics.gender_counts.male],
                    ["UNKNOWN", "Unknown", inspection.statistics.gender_counts.unknown],
                ].map(([value, label, count]) => (
                    <Chip
                        key={String(value)}
                        size="small"
                        clickable
                        label={`${label} (${Number(count).toLocaleString()})`}
                        color={
                            selectedGenders.includes(
                                value as GenderFilterValue,
                            )
                                ? "primary"
                                : "default"
                        }
                        variant={
                            selectedGenders.includes(
                                value as GenderFilterValue,
                            )
                                ? "filled"
                                : "outlined"
                        }
                        onClick={() =>
                            onSelectedGendersChange(
                                toggleGender(
                                    selectedGenders,
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
                value={minimumExhibitedItems}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                onChange={(event) =>
                    onMinimumExhibitedItemsChange(
                        Math.max(
                            0,
                            Math.floor(
                                Number(event.target.value) || 0,
                            ),
                        ),
                    )
                }
                helperText="Recorded exhibition catalogue entries per Artist."
                sx={{ mb: 2 }}
            />

            <Typography
                variant="subtitle2"
                sx={{
                    fontWeight: 700,
                }}
            >
                Minimum cluster assignment strength
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

            {inspection.group_composition.length > 0 && (
                <>
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 700,
                        }}
                        gutterBottom
                    >
                        Artist groups in cluster
                    </Typography>

                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Artist group status"
                        value={groupMembership}
                        onChange={(event) => {
                            const nextStatus = event.target.value as GroupMembershipFilter;
                            onGroupMembershipChange(nextStatus);

                            if (nextStatus === "not-member") {
                                onSelectedGroupIdsChange([]);
                            }
                        }}
                        sx={{ mb: 1 }}
                    >
                        <MenuItem value="all">All Artists</MenuItem>
                        <MenuItem value="member">Member of a Group</MenuItem>
                        <MenuItem value="not-member">Not Member of a Group</MenuItem>
                    </TextField>

                    {groupMembership !== "not-member" && (
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

                            <ScentedList
                                items={
                                    filteredGroupComposition.map(
                                        (group) => ({
                                            id: group.id,
                                            label: group.name,
                                            count: group.artist_count,
                                        }),
                                    )
                                }
                                selectedIds={selectedGroupIds}
                                onToggle={(groupId) => {
                                    onGroupMembershipChange("member");
                                    onSelectedGroupIdsChange(
                                        toggle(
                                            selectedGroupIds,
                                            groupId,
                                        ),
                                    );
                                }}
                                maxVisibleHeight={240}
                            />
                        </>
                    )}

                    <Divider
                        sx={{
                            my: 2,
                        }}
                    />
                </>
            )}

            {hasLocationOptions && (
                <>
                    <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700 }}
                        gutterBottom
                    >
                        Exhibition locations in cluster
                    </Typography>

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

                    <ScentedList
                        items={locationOptions}
                        selectedIds={selectedLocationIds}
                        onToggle={(locationId) =>
                            onSelectedLocationIdsChange(
                                toggle(
                                    selectedLocationIds,
                                    locationId,
                                ),
                            )
                        }
                        maxVisibleHeight={220}
                    />

                    <Divider sx={{ my: 2 }} />
                </>
            )}

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
