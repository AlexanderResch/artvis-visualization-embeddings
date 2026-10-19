import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    fetchArtistConnectingPaths,
} from "../../api/comparisonApi";

import type {
    ComparisonConnectingPaths,
    ComparisonShortestPath,
} from "../../types/comparison";

import {
    ComparisonShortestPath as PathCanvas,
} from "./ComparisonShortestPath";


type MaximumHops = 2 | 3 | 4 | 5;
type PathMode = "shortest" | "all";


function pathSummary(
    path: ComparisonShortestPath,
): string {
    return path.nodes
        .map((node) => node.label)
        .join(" → ");
}


export function ComparisonPathExplorer({
                                           artistAId,
                                           artistBId,
                                           showEdgeLabels,
                                           onSelectArtist,
                                       }: {
    artistAId: string;
    artistBId: string;
    showEdgeLabels: boolean;
    onSelectArtist: (artistId: string) => void;
}) {
    const [maximumHops, setMaximumHops] =
        useState<MaximumHops>(2);
    const [mode, setMode] =
        useState<PathMode>("shortest");
    const requestKey =
        `${artistAId}:${artistBId}:${maximumHops}`;
    const [loadState, setLoadState] = useState<{
        key: string;
        result: ComparisonConnectingPaths | null;
        error: string | null;
    }>({
        key: "",
        result: null,
        error: null,
    });
    const [selectedIndex, setSelectedIndex] = useState(0);

    const loading = loadState.key !== requestKey;
    const result = loading ? null : loadState.result;
    const error = loading ? null : loadState.error;

    useEffect(
        () => {
            const controller = new AbortController();

            fetchArtistConnectingPaths(
                artistAId,
                artistBId,
                maximumHops,
                controller.signal,
            )
                .then((response) => {
                    setLoadState({
                        key: requestKey,
                        result: response,
                        error: null,
                    });
                    setSelectedIndex(0);
                })
                .catch((requestError: unknown) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    setLoadState({
                        key: requestKey,
                        result: null,
                        error: (
                            requestError instanceof Error
                                ? requestError.message
                                : "The connecting paths could not be loaded."
                        ),
                    });
                });

            return () => controller.abort();
        },
        [
            artistAId,
            artistBId,
            maximumHops,
            requestKey,
        ],
    );

    const displayedPaths = useMemo(
        () => {
            if (!result) {
                return [];
            }

            if (
                mode === "shortest"
                && result.shortest_hops !== null
            ) {
                return result.paths.filter(
                    (path) =>
                        path.hops === result.shortest_hops,
                );
            }

            return result.paths;
        },
        [mode, result],
    );

    const displayedPathCounts = useMemo(
        () => {
            const counts = new Map<number, number>();

            for (const path of displayedPaths) {
                if (path.hops === null) {
                    continue;
                }

                counts.set(
                    path.hops,
                    (counts.get(path.hops) ?? 0) + 1,
                );
            }

            return Array.from(counts.entries())
                .sort(([first], [second]) => first - second);
        },
        [displayedPaths],
    );

    const selectedPath =
        displayedPaths[selectedIndex]
        ?? displayedPaths[0]
        ?? null;

    return (
        <Box>
            <Box
                sx={{
                    p: 1.5,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 1,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={mode}
                    onChange={(_, value: PathMode | null) => {
                        if (value !== null) {
                            setMode(value);
                            setSelectedIndex(0);
                        }
                    }}
                    aria-label="Path result mode"
                >
                    <ToggleButton value="shortest">
                        All shortest paths
                    </ToggleButton>
                    <ToggleButton value="all">
                        All paths
                    </ToggleButton>
                </ToggleButtonGroup>

                <FormControl
                    size="small"
                    sx={{ minWidth: 150 }}
                >
                    <InputLabel id="maximum-path-length-label">
                        Maximum length
                    </InputLabel>
                    <Select
                        labelId="maximum-path-length-label"
                        value={maximumHops}
                        label="Maximum length"
                        onChange={(event) => {
                            setMaximumHops(
                                Number(event.target.value) as MaximumHops,
                            );
                            setSelectedIndex(0);
                        }}
                    >
                        {[2, 3, 4, 5].map((value) => (
                            <MenuItem
                                key={value}
                                value={value}
                            >
                                {value} relationships
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {result && !loading && (
                    <>
                        <Chip
                            size="small"
                            variant="outlined"
                            label={`${displayedPaths.length} ${
                                mode === "shortest"
                                    ? "shortest"
                                    : "matching"
                            } path${displayedPaths.length === 1 ? "" : "s"}`}
                        />
                        {displayedPathCounts.map(([length, count]) => (
                            <Chip
                                key={length}
                                size="small"
                                variant="outlined"
                                label={`${length} relationships: ${count}`}
                            />
                        ))}
                        {result.truncated && (
                            <Chip
                                size="small"
                                color="warning"
                                label={`Limit of ${result.limit_per_length} reached for length${
                                    result.truncated_lengths.length === 1
                                        ? ""
                                        : "s"
                                } ${result.truncated_lengths.join(", ")}`}
                            />
                        )}
                    </>
                )}
            </Box>

            {loading && (
                <Box
                    sx={{
                        minHeight: 360,
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    <CircularProgress />
                </Box>
            )}

            {!loading && error && (
                <Box sx={{ p: 2 }}>
                    <Alert severity="error">
                        {error}
                    </Alert>
                </Box>
            )}

            {!loading && !error && result && displayedPaths.length === 0 && (
                <Box sx={{ p: 2 }}>
                    <Alert severity="info">
                        No simple connecting path with 2 to {maximumHops} relationships was found.
                    </Alert>
                </Box>
            )}

            {!loading && !error && selectedPath && (
                <>
                    <Box
                        sx={{
                            px: 1.5,
                            pt: 1.25,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={selectedIndex <= 0}
                            onClick={() =>
                                setSelectedIndex((value) => value - 1)
                            }
                        >
                            Previous
                        </Button>

                        <FormControl
                            size="small"
                            sx={{
                                flex: 1,
                                minWidth: 180,
                            }}
                        >
                            <InputLabel id="connecting-path-label">
                                Displayed path
                            </InputLabel>
                            <Select
                                labelId="connecting-path-label"
                                value={selectedIndex}
                                label="Displayed path"
                                onChange={(event) =>
                                    setSelectedIndex(
                                        Number(event.target.value),
                                    )
                                }
                            >
                                {displayedPaths.map((path, index) => (
                                    <MenuItem
                                        key={`${pathSummary(path)}-${index}`}
                                        value={index}
                                    >
                                        Path {index + 1} · {path.hops} relationships · {pathSummary(path)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button
                            size="small"
                            variant="outlined"
                            disabled={
                                selectedIndex
                                >= displayedPaths.length - 1
                            }
                            onClick={() =>
                                setSelectedIndex((value) => value + 1)
                            }
                        >
                            Next
                        </Button>
                    </Box>

                    <Box sx={{ px: 1.5, pt: 1 }}>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                        >
                            Path {selectedIndex + 1} of {displayedPaths.length} · {selectedPath.hops} relationships
                        </Typography>
                    </Box>

                    <PathCanvas
                        path={selectedPath}
                        showEdgeLabels={showEdgeLabels}
                        onSelectArtist={onSelectArtist}
                    />
                </>
            )}
        </Box>
    );
}
