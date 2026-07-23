import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    FormControlLabel,
    Switch,
    TextField,
    Typography,
} from "@mui/material";

import {
    useMemo,
    useState,
} from "react";

import type {
    ArtistEmbedding2D,
} from "../../types/embedding";

import {
    clusterColor,
    clusterTextColor,
} from "../../visualization/colors";


const MAX_SEARCH_RESULTS = 75;


function artistKey(
    artist: ArtistEmbedding2D,
): string {
    return artist.id
        || artist.entity
        || String(artist.artist_index);
}


function artistLabel(
    artist: ArtistEmbedding2D,
): string {
    const displayName =
        typeof artist.display_name === "string"
            ? artist.display_name.trim()
            : "";

    return displayName
        || artist.entity
        || "Unknown Artist";
}


function normalize(
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


const accordionSx = {
    mb: 1,
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "8px !important",
    boxShadow: "none",

    "&::before": {
        display: "none",
    },

    "&.Mui-expanded": {
        margin: 0,
        mb: 1,
    },
};


function ArtistSelector({
                            label,
                            artists,
                            value,
                            otherArtistId,
                            onChange,
                        }: {
    label: string;
    artists: ArtistEmbedding2D[];
    value: ArtistEmbedding2D | null;
    otherArtistId: string | null;
    onChange: (
        artist: ArtistEmbedding2D | null,
    ) => void;
}) {
    const [open, setOpen] =
        useState(false);

    return (
        <Autocomplete
            size="small"
            options={artists}
            value={value}
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            getOptionKey={artistKey}
            getOptionLabel={artistLabel}
            isOptionEqualToValue={(
                option,
                selected,
            ) =>
                artistKey(option)
                === artistKey(selected)
            }
            getOptionDisabled={
                (artist) =>
                    artist.id
                    === otherArtistId
            }
            filterOptions={(
                availableArtists,
                state,
            ) => {
                const searchValue =
                    normalize(
                        state.inputValue,
                    );

                if (!searchValue) {
                    return [];
                }

                return availableArtists
                    .filter(
                        (artist) => {
                            const searchable =
                                normalize(
                                    `${artistLabel(artist)} ${artist.id} ${artist.entity}`,
                                );

                            return searchable.includes(
                                searchValue,
                            );
                        },
                    )
                    .slice(
                        0,
                        MAX_SEARCH_RESULTS,
                    );
            }}
            onChange={(
                _,
                artist,
            ) => {
                onChange(artist);
                setOpen(false);
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
                            ?? artistKey(artist)
                        }
                        {...optionProps}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                flexShrink: 0,
                                borderRadius: "50%",
                                backgroundColor:
                                    clusterColor(
                                        artist.cluster,
                                    ),
                            }}
                        />

                        <Box
                            sx={{
                                minWidth: 0,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 700,
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
                                {" · "}
                                {artist.is_noise
                                    ? "Noise"
                                    : `Cluster ${artist.cluster}`}
                            </Typography>
                        </Box>
                    </Box>
                );
            }}
            renderInput={
                (params) => (
                    <TextField
                        {...params}
                        label={label}
                        placeholder="Type an Artist name…"
                        autoComplete="off"
                    />
                )
            }
            noOptionsText="Start typing to search"
            slotProps={{
                listbox: {
                    style: {
                        maxHeight: 320,
                        overflowY: "auto",
                    },
                },
            }}
        />
    );
}


function ArtistCard({
                        prefix,
                        artist,
                    }: {
    prefix: "A" | "B";
    artist: ArtistEmbedding2D;
}) {
    return (
        <Box
            sx={{
                p: 1.25,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                backgroundColor:
                    "background.paper",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                        "space-between",
                    gap: 1,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Artist {prefix}
                    </Typography>

                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 800,
                        }}
                        noWrap
                        title={artistLabel(artist)}
                    >
                        {artistLabel(artist)}
                    </Typography>
                </Box>

                <Chip
                    size="small"
                    label={
                        artist.is_noise
                            ? "Noise"
                            : `Cluster ${artist.cluster}`
                    }
                    sx={{
                        color:
                            clusterTextColor(
                                artist.cluster,
                            ),
                        backgroundColor:
                            clusterColor(
                                artist.cluster,
                            ),
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                />
            </Box>
        </Box>
    );
}


export function ComparisonSidebar({
                                      artists,
                                      artistA,
                                      artistB,
                                      selectingSecondArtist,
                                      showMapContext,
                                      showEdgeLabels,
                                      onArtistAChange,
                                      onArtistBChange,
                                      onShowMapContextChange,
                                      onShowEdgeLabelsChange,
                                      onSwap,
                                      onReset,
                                  }: {
    artists: ArtistEmbedding2D[];
    artistA: ArtistEmbedding2D;
    artistB: ArtistEmbedding2D | null;
    selectingSecondArtist: boolean;
    showMapContext: boolean;
    showEdgeLabels: boolean;
    onArtistAChange: (
        artist: ArtistEmbedding2D,
    ) => void;
    onArtistBChange: (
        artist: ArtistEmbedding2D | null,
    ) => void;
    onShowMapContextChange: (
        show: boolean,
    ) => void;
    onShowEdgeLabelsChange: (
        show: boolean,
    ) => void;
    onSwap: () => void;
    onReset: () => void;
}) {
    const orderedArtists =
        useMemo(
            () => {
                const unique =
                    new Map<
                        string,
                        ArtistEmbedding2D
                    >();

                for (const artist of artists) {
                    unique.set(
                        artistKey(artist),
                        artist,
                    );
                }

                return Array.from(
                    unique.values(),
                ).sort(
                    (first, second) =>
                        artistLabel(first)
                            .localeCompare(
                                artistLabel(second),
                                undefined,
                                {
                                    sensitivity: "base",
                                },
                            ),
                );
            },
            [artists],
        );

    return (
        <Box sx={{ p: 1.5 }}>
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 800,
                    mb: 1,
                }}
            >
                Comparison controls
            </Typography>

            {selectingSecondArtist && (
                <Alert
                    severity="info"
                    sx={{ mb: 1.5 }}
                >
                    Select a second Artist on the embedding map or use the Artist B search field.
                </Alert>
            )}

            <Box
                sx={{
                    display: "grid",
                    gap: 1,
                    mb: 1.5,
                }}
            >
                <ArtistCard
                    prefix="A"
                    artist={artistA}
                />

                {artistB && (
                    <ArtistCard
                        prefix="B"
                        artist={artistB}
                    />
                )}
            </Box>

            <Box
                sx={{
                    display: "grid",
                    gap: 1.25,
                    mb: 1.5,
                }}
            >
                <ArtistSelector
                    label="Artist A"
                    artists={orderedArtists}
                    value={artistA}
                    otherArtistId={
                        artistB?.id
                        ?? null
                    }
                    onChange={
                        (artist) => {
                            if (artist) {
                                onArtistAChange(
                                    artist,
                                );
                            }
                        }
                    }
                />

                <ArtistSelector
                    label="Artist B"
                    artists={orderedArtists}
                    value={artistB}
                    otherArtistId={artistA.id}
                    onChange={onArtistBChange}
                />
            </Box>

            <Button
                fullWidth
                variant="outlined"
                disabled={!artistB}
                onClick={onSwap}
                sx={{ mb: 1.5 }}
            >
                Swap Artists
            </Button>

            <Accordion
                disableGutters
                defaultExpanded
                sx={accordionSx}
            >
                <AccordionSummary
                    expandIcon={
                        <ExpandIndicator />
                    }
                >
                    <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700 }}
                    >
                        Embedding map
                    </Typography>
                </AccordionSummary>

                <AccordionDetails>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={
                                    showMapContext
                                }
                                onChange={
                                    (event) =>
                                        onShowMapContextChange(
                                            event.target.checked,
                                        )
                                }
                            />
                        }
                        label="Show surrounding Artists"
                    />

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                    >
                        When disabled, only the two compared Artists remain visible.
                    </Typography>
                </AccordionDetails>
            </Accordion>

            <Accordion
                disableGutters
                defaultExpanded
                sx={accordionSx}
            >
                <AccordionSummary
                    expandIcon={
                        <ExpandIndicator />
                    }
                >
                    <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700 }}
                    >
                        Shortest path diagram
                    </Typography>
                </AccordionSummary>

                <AccordionDetails>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mb: 0.75,
                        }}
                    >
                        The shortest available graph path between both Artists is calculated automatically.
                    </Typography>

                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={
                                    showEdgeLabels
                                }
                                onChange={
                                    (event) =>
                                        onShowEdgeLabelsChange(
                                            event.target.checked,
                                        )
                                }
                            />
                        }
                        label="Show relationship labels"
                    />
                </AccordionDetails>
            </Accordion>

            <Button
                fullWidth
                variant="outlined"
                onClick={onReset}
                sx={{ mt: 1 }}
            >
                Reset comparison
            </Button>
        </Box>
    );
}
