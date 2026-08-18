import {
    Alert,
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
    useMemo,
    useState,
} from "react";

import type {
    YearRange,
} from "../../context/ExplorerContext";

import type {
    ClusterInspection,
} from "../../types/cluster";

import type {
    ClusterOption,
} from "../../types/dashboard";

import type {
    ArtistEmbedding2D,
    GenderFilterValue,
    GroupMembershipFilter,
} from "../../types/embedding";

import {
    ScentedList,
} from "../filters/ScentedList";

import {
    matchesSearchTokens,
} from "../../utils/search";


const MAX_SEARCH_RESULTS = 100;


function normalizeSearchText(value: string): string {
    return value
        .trim()
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


function artistLabel(artist: ArtistEmbedding2D): string {
    return artist.display_name?.trim()
        || artist.entity
        || "Unknown Artist";
}


function toggleGender(
    values: GenderFilterValue[],
    value: GenderFilterValue,
): GenderFilterValue[] {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}


function toggle(values: string[], value: string): string[] {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}


function ArtistClusterSearch({
                                 label,
                                 artists,
                                 otherClusterId,
                                 onClusterChange,
                             }: {
    label: string;
    artists: ArtistEmbedding2D[];
    otherClusterId: number | null;
    onClusterChange: (clusterId: number) => void;
}) {
    const [inputValue, setInputValue] = useState("");
    const [open, setOpen] = useState(false);

    const orderedArtists = useMemo(
        () => [...artists].sort(
            (first, second) => artistLabel(first).localeCompare(
                artistLabel(second),
                undefined,
                { sensitivity: "base" },
            ),
        ),
        [artists],
    );

    return (
        <Autocomplete
            size="small"
            options={orderedArtists}
            value={null}
            inputValue={inputValue}
            open={open && inputValue.trim().length > 0}
            autoHighlight
            clearOnEscape
            getOptionKey={(artist) => artist.id}
            getOptionLabel={artistLabel}
            getOptionDisabled={(artist) =>
                artist.is_noise
                || artist.cluster < 0
                || artist.cluster === otherClusterId
            }
            filterOptions={(availableOptions, state) => {
                const query = normalizeSearchText(state.inputValue);

                if (!query) {
                    return [];
                }

                return availableOptions
                    .filter((artist) => {
                        const name = normalizeSearchText(artistLabel(artist));
                        const id = normalizeSearchText(artist.id);
                        return matchesSearchTokens(
                            `${name} ${id}`,
                            query,
                        );
                    })
                    .slice(0, MAX_SEARCH_RESULTS);
            }}
            onInputChange={(_, value, reason) => {
                if (reason === "input") {
                    setInputValue(value);
                    setOpen(value.trim().length > 0);
                } else if (reason === "clear") {
                    setInputValue("");
                    setOpen(false);
                }
            }}
            onClose={() => setOpen(false)}
            onChange={(_, artist) => {
                setOpen(false);

                if (!artist || artist.is_noise || artist.cluster < 0) {
                    return;
                }

                onClusterChange(artist.cluster);
                setInputValue(artistLabel(artist));
            }}
            renderOption={(props, artist) => {
                const { key, ...optionProps } = props;
                const status = artist.is_noise || artist.cluster < 0
                    ? "Not part of a cluster (Noise)"
                    : artist.cluster === otherClusterId
                        ? `Cluster ${artist.cluster} · already selected on the other side`
                        : `Cluster ${artist.cluster}`;

                return (
                    <Box
                        component="li"
                        key={key ?? artist.id}
                        {...optionProps}
                        sx={{ display: "block", py: 0.8 }}
                    >
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {artistLabel(artist)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                            {status}
                        </Typography>
                    </Box>
                );
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    placeholder="Type an Artist name…"
                    autoComplete="off"
                    helperText="Selecting an Artist sets this side to the Artist's computed cluster."
                />
            )}
            noOptionsText="No Artist found"
            slotProps={{
                listbox: {
                    style: {
                        maxHeight: 360,
                        overflowY: "auto",
                    },
                },
            }}
        />
    );
}


export function ClusterComparisonSidebar({
                                             clusters,
                                             artists,
                                             inspectionA,
                                             inspectionB,
                                             clusterAId,
                                             clusterBId,
                                             visibleArtistCountA,
                                             visibleArtistCountB,
                                             selectedGenders,
                                             onSelectedGendersChange,
                                             minimumExhibitedItems,
                                             onMinimumExhibitedItemsChange,
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
                                             onClusterAChange,
                                             onClusterBChange,
                                             onSwap,
                                             onResetComparison,
                                             onResetFilters,
                                         }: {
    clusters: ClusterOption[];
    artists: ArtistEmbedding2D[];
    inspectionA: ClusterInspection | null;
    inspectionB: ClusterInspection | null;
    clusterAId: number | null;
    clusterBId: number | null;
    visibleArtistCountA: number;
    visibleArtistCountB: number;
    selectedGenders: GenderFilterValue[];
    onSelectedGendersChange: (value: GenderFilterValue[]) => void;
    minimumExhibitedItems: number;
    onMinimumExhibitedItemsChange: (value: number) => void;
    minimumMembership: number;
    onMinimumMembershipChange: (value: number) => void;
    yearRange: YearRange | null;
    onYearRangeChange: (value: YearRange | null) => void;
    selectedGroupIds: string[];
    onSelectedGroupIdsChange: (value: string[]) => void;
    groupMembership: GroupMembershipFilter;
    onGroupMembershipChange: (value: GroupMembershipFilter) => void;
    selectedLocationIds: string[];
    onSelectedLocationIdsChange: (value: string[]) => void;
    onClusterAChange: (clusterId: number) => void;
    onClusterBChange: (clusterId: number | null) => void;
    onSwap: () => void;
    onResetComparison: () => void;
    onResetFilters: () => void;
}) {
    const [
        groupSearchInput,
        setGroupSearchInput,
    ] = useState("");

    const [
        locationSearchInput,
        setLocationSearchInput,
    ] = useState("");

    const availableClusters = clusters
        .filter((cluster) => !cluster.is_noise)
        .sort((first, second) => first.cluster - second.cluster);

    const minimumYear = Math.min(
        inspectionA?.statistics.birth_year.minimum ?? 1800,
        inspectionB?.statistics.birth_year.minimum ?? 1800,
    );

    const maximumYear = Math.max(
        inspectionA?.statistics.birth_year.maximum ?? 2000,
        inspectionB?.statistics.birth_year.maximum ?? 2000,
    );

    const displayedYearRange: YearRange = yearRange ?? [minimumYear, maximumYear];

    const groupOptions = useMemo(() => {
        const byId = new Map<string, { id: string; label: string; count: number }>();

        for (const inspection of [inspectionA, inspectionB]) {
            for (const group of inspection?.group_composition ?? []) {
                const current = byId.get(group.id);
                byId.set(group.id, {
                    id: group.id,
                    label: group.name,
                    count: (current?.count ?? 0) + group.artist_count,
                });
            }
        }

        return [...byId.values()].sort((first, second) =>
            second.count - first.count || first.label.localeCompare(second.label),
        );
    }, [inspectionA, inspectionB]);

    const filteredGroupOptions = useMemo(
        () =>
            groupOptions.filter(
                (group) =>
                    matchesSearchTokens(
                        `${group.label} ${group.id}`,
                        groupSearchInput,
                    ),
            ),
        [
            groupOptions,
            groupSearchInput,
        ],
    );

    const locationOptions = useMemo(() => {
        const byId = new Map<
            string,
            {
                id: string;
                label: string;
                count: number;
            }
        >();

        for (const inspection of [inspectionA, inspectionB]) {
            for (const location of inspection?.location_composition ?? []) {
                const current = byId.get(location.id);

                byId.set(location.id, {
                    id: location.id,
                    label: location.name,
                    count: (current?.count ?? 0) + location.artist_count,
                });
            }
        }

        return [...byId.values()].sort(
            (first, second) =>
                second.count - first.count
                || first.label.localeCompare(
                    second.label,
                    undefined,
                    { sensitivity: "base" },
                ),
        );
    }, [inspectionA, inspectionB]);

    const filteredLocationOptions = useMemo(
        () =>
            locationOptions.filter(
                (location) =>
                    matchesSearchTokens(
                        `${location.label} ${location.id}`,
                        locationSearchInput,
                    ),
            ),
        [
            locationOptions,
            locationSearchInput,
        ],
    );

    return (
        <Box sx={{ p: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Compare clusters
            </Typography>

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.5 }}
            >
                Select two computed clusters directly, or find their cluster by searching for a known Artist.
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                Cluster A
            </Typography>
            <TextField
                select
                fullWidth
                size="small"
                label="Cluster A"
                value={clusterAId ?? ""}
                onChange={(event) => onClusterAChange(Number(event.target.value))}
                sx={{ mb: 1 }}
            >
                {availableClusters
                    .filter((cluster) => cluster.cluster !== clusterBId)
                    .map((cluster) => (
                        <MenuItem key={cluster.cluster} value={cluster.cluster}>
                            Cluster {cluster.cluster} · {cluster.artist_count.toLocaleString()} Artists
                        </MenuItem>
                    ))}
            </TextField>

            <ArtistClusterSearch
                label="Find Cluster A by Artist"
                artists={artists}
                otherClusterId={clusterBId}
                onClusterChange={onClusterAChange}
            />

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.75, mb: 1.5 }}
            >
                {inspectionA
                    ? `${visibleArtistCountA.toLocaleString()} of ${inspectionA.artist_count.toLocaleString()} Artists match the current filters.`
                    : "Select Cluster A."}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                Cluster B
            </Typography>
            <TextField
                select
                fullWidth
                size="small"
                label="Cluster B"
                value={clusterBId ?? ""}
                onChange={(event) => {
                    const value = event.target.value;
                    onClusterBChange(value === "" ? null : Number(value));
                }}
                sx={{ mb: 1 }}
            >
                <MenuItem value="">Select second cluster</MenuItem>
                {availableClusters
                    .filter((cluster) => cluster.cluster !== clusterAId)
                    .map((cluster) => (
                        <MenuItem key={cluster.cluster} value={cluster.cluster}>
                            Cluster {cluster.cluster} · {cluster.artist_count.toLocaleString()} Artists
                        </MenuItem>
                    ))}
            </TextField>

            <ArtistClusterSearch
                label="Find Cluster B by Artist"
                artists={artists}
                otherClusterId={clusterAId}
                onClusterChange={(clusterId) => onClusterBChange(clusterId)}
            />

            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.75 }}
            >
                {inspectionB
                    ? `${visibleArtistCountB.toLocaleString()} of ${inspectionB.artist_count.toLocaleString()} Artists match the current filters.`
                    : "Select Cluster B to load the comparison."}
            </Typography>

            {clusterBId === null ? (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                    Select Cluster B to load the comparison.
                </Alert>
            ) : null}

            <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
                <Button
                    variant="outlined"
                    disabled={clusterAId === null || clusterBId === null}
                    onClick={onSwap}
                >
                    Swap A / B
                </Button>
                <Button
                    variant="text"
                    disabled={clusterBId === null}
                    onClick={onResetComparison}
                >
                    Clear B
                </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.4 }}>
                Filter Artists
            </Typography>
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1.25 }}
            >
                The same filters are applied to Cluster A and Cluster B.
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                Gender
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                {[
                    ["F", "Female"],
                    ["M", "Male"],
                    ["UNKNOWN", "Unknown"],
                ].map(([value, label]) => (
                    <Chip
                        key={value}
                        size="small"
                        clickable
                        label={label}
                        color={selectedGenders.includes(value as GenderFilterValue) ? "primary" : "default"}
                        variant={selectedGenders.includes(value as GenderFilterValue) ? "filled" : "outlined"}
                        onClick={() => onSelectedGendersChange(
                            toggleGender(selectedGenders, value as GenderFilterValue),
                        )}
                    />
                ))}
            </Box>

            <TextField
                fullWidth
                size="small"
                type="number"
                label="Minimum exhibited artworks"
                value={minimumExhibitedItems}
                inputProps={{ min: 0, step: 1 }}
                onChange={(event) => onMinimumExhibitedItemsChange(
                    Math.max(0, Math.floor(Number(event.target.value) || 0)),
                )}
                helperText="Recorded exhibition catalogue entries per Artist."
                sx={{ mb: 2 }}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Minimum cluster assignment strength
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {minimumMembership.toFixed(2)}
            </Typography>
            <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={minimumMembership}
                onChange={(_, value) => onMinimumMembershipChange(value as number)}
                sx={{ mb: 1.5 }}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                Birth-year range
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {displayedYearRange[0]} to {displayedYearRange[1]}
            </Typography>
            <Slider
                size="small"
                min={minimumYear}
                max={maximumYear}
                value={displayedYearRange}
                onChange={(_, value) => onYearRangeChange(value as YearRange)}
                valueLabelDisplay="auto"
                disableSwap
            />
            {yearRange ? (
                <Button size="small" onClick={() => onYearRangeChange(null)} sx={{ mb: 1 }}>
                    Clear year filter
                </Button>
            ) : null}

            {groupOptions.length > 0 && (
                <>
                    <Divider sx={{ my: 1.5 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                        Artist groups
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
                                items={filteredGroupOptions}
                                selectedIds={selectedGroupIds}
                                onToggle={(groupId) => {
                                    onGroupMembershipChange("member");
                                    onSelectedGroupIdsChange(
                                        toggle(selectedGroupIds, groupId),
                                    );
                                }}
                                maxVisibleHeight={220}
                            />
                        </>
                    )}
                </>
            )}

            {locationOptions.length > 0 && (
                <>
                    <Divider sx={{ my: 1.5 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
                        Exhibition locations
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
                        items={filteredLocationOptions}
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
                </>
            )}

            <Button
                fullWidth
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={onResetFilters}
            >
                Reset comparison filters
            </Button>
        </Box>
    );
}
