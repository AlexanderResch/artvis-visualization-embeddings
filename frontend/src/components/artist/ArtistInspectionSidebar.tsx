import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    ButtonGroup,
    Checkbox,
    Chip,
    FormControlLabel,
    MenuItem,
    Slider,
    Switch,
    TextField,
    Typography,
} from "@mui/material";

import type {
    ArtistEmbedding2D,
} from "../../types/embedding";

import type {
    ArtistInspectionNodeTypeCount,
} from "../../types/artistInspection";

import {
    clusterColor,
    clusterTextColor,
} from "../../visualization/colors";

import {
    entityTypeColor,
} from "../../visualization/entityColors";


function artistLabel(
    artist: ArtistEmbedding2D,
): string {
    const name =
        typeof artist.display_name === "string"
            ? artist.display_name.trim()
            : "";

    return name
        || artist.entity
        || "Unknown Artist";
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
    overflow: "hidden",

    "&::before": {
        display: "none",
    },

    "&.Mui-expanded": {
        margin: 0,
        mb: 1,
    },
};


const summarySx = {
    minHeight: 48,
    px: 1.25,
    backgroundColor: "action.hover",

    "&.Mui-expanded": {
        minHeight: 48,
    },

    "& .MuiAccordionSummary-content": {
        my: 1,
    },

    "& .MuiAccordionSummary-content.Mui-expanded": {
        my: 1,
    },
};


type ArtistInspectionSidebarProps = {
    artist: ArtistEmbedding2D;
    similarityThreshold: number;
    onSimilarityThresholdChange: (
        value: number,
    ) => void;
    similarArtistLimit: number;
    onSimilarArtistLimitChange: (
        value: number,
    ) => void;
    egoDepth: 1 | 2;
    onEgoDepthChange: (
        depth: 1 | 2,
    ) => void;
    nodeTypeCounts: ArtistInspectionNodeTypeCount[];
    selectedNodeTypes: string[];
    onSelectedNodeTypesChange: (
        nodeTypes: string[],
    ) => void;
    relationshipTypeCounts: ArtistInspectionNodeTypeCount[];
    selectedRelationshipTypes: string[];
    onSelectedRelationshipTypesChange: (
        relationshipTypes: string[],
    ) => void;
    timelineBinSize: 1 | 5 | 10;
    onTimelineBinSizeChange: (
        binSize: 1 | 5 | 10,
    ) => void;
    showSurroundingClusters: boolean;
    onShowSurroundingClustersChange: (
        value: boolean,
    ) => void;
    onReset: () => void;
};


export function ArtistInspectionSidebar({
                                            artist,
                                            similarityThreshold,
                                            onSimilarityThresholdChange,
                                            similarArtistLimit,
                                            onSimilarArtistLimitChange,
                                            egoDepth,
                                            onEgoDepthChange,
                                            nodeTypeCounts,
                                            selectedNodeTypes,
                                            onSelectedNodeTypesChange,
                                            relationshipTypeCounts,
                                            selectedRelationshipTypes,
                                            onSelectedRelationshipTypesChange,
                                            timelineBinSize,
                                            onTimelineBinSizeChange,
                                            showSurroundingClusters,
                                            onShowSurroundingClustersChange,
                                            onReset,
                                        }: ArtistInspectionSidebarProps) {
    const hasCluster =
        artist.cluster >= 0;

    function toggleNodeType(
        nodeType: string,
    ) {
        onSelectedNodeTypesChange(
            selectedNodeTypes.includes(
                nodeType,
            )
                ? selectedNodeTypes.filter(
                    (item) =>
                        item !== nodeType,
                )
                : [
                    ...selectedNodeTypes,
                    nodeType,
                ],
        );
    }

    function toggleRelationshipType(
        relationshipType: string,
    ) {
        onSelectedRelationshipTypesChange(
            selectedRelationshipTypes.includes(
                relationshipType,
            )
                ? selectedRelationshipTypes.filter(
                    (item) =>
                        item !== relationshipType,
                )
                : [
                    ...selectedRelationshipTypes,
                    relationshipType,
                ],
        );
    }

    return (
        <Box
            sx={{
                p: 1.5,
            }}
        >
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 800,
                    mb: 1,
                }}
            >
                Artist analysis
            </Typography>

            <Box
                sx={{
                    p: 1.25,
                    mb: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    backgroundColor:
                        "background.paper",
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 700,
                    }}
                    noWrap
                    title={
                        artistLabel(artist)
                    }
                >
                    {artistLabel(artist)}
                </Typography>

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        display: "block",
                        mt: 0.25,
                    }}
                >
                    {artist.birth_year ?? "?"}
                    {"–"}
                    {artist.death_year ?? "?"}
                </Typography>

                <Chip
                    size="small"
                    label={
                        hasCluster
                            ? `Cluster ${artist.cluster}`
                            : "Noise"
                    }
                    sx={{
                        mt: 1,
                        color:
                            clusterTextColor(
                                artist.cluster,
                            ),
                        backgroundColor:
                            clusterColor(
                                artist.cluster,
                            ),
                        fontWeight: 700,
                    }}
                />
            </Box>

            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    mb: 1.5,
                }}
            >
                These controls adjust the Artist-specific analysis instead of filtering the Artist itself.
            </Typography>

            <Accordion
                disableGutters
                defaultExpanded
                sx={accordionSx}
            >
                <AccordionSummary
                    expandIcon={
                        <ExpandIndicator />
                    }
                    sx={summarySx}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        Similarity context
                    </Typography>
                </AccordionSummary>

                <AccordionDetails
                    sx={{
                        px: 1.25,
                        pt: 1,
                        pb: 1.25,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Minimum similarity: {similarityThreshold.toFixed(2)}
                    </Typography>

                    <Slider
                        size="small"
                        min={0.4}
                        max={1}
                        step={0.01}
                        value={
                            similarityThreshold
                        }
                        onChange={(
                            _,
                            value,
                        ) =>
                            onSimilarityThresholdChange(
                                value as number,
                            )
                        }
                    />

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Maximum similar Artists: {similarArtistLimit}
                    </Typography>

                    <Slider
                        size="small"
                        min={5}
                        max={30}
                        step={5}
                        marks
                        value={
                            similarArtistLimit
                        }
                        onChange={(
                            _,
                            value,
                        ) =>
                            onSimilarArtistLimitChange(
                                value as number,
                            )
                        }
                    />
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
                    sx={summarySx}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        Ego network
                    </Typography>
                </AccordionSummary>

                <AccordionDetails
                    sx={{
                        px: 1.25,
                        pt: 1,
                        pb: 1.25,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mb: 0.75,
                        }}
                    >
                        Network depth
                    </Typography>

                    <ButtonGroup
                        fullWidth
                        size="small"
                        sx={{
                            mb: 1.25,
                        }}
                    >
                        <Button
                            variant={
                                egoDepth === 1
                                    ? "contained"
                                    : "outlined"
                            }
                            onClick={() =>
                                onEgoDepthChange(1)
                            }
                        >
                            1 hop
                        </Button>

                        <Button
                            variant={
                                egoDepth === 2
                                    ? "contained"
                                    : "outlined"
                            }
                            onClick={() =>
                                onEgoDepthChange(2)
                            }
                        >
                            2 hops
                        </Button>
                    </ButtonGroup>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mb: 0.5,
                        }}
                    >
                        Visible entity types
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gap: 0.25,
                        }}
                    >
                        {nodeTypeCounts.map(
                            (item) => (
                                <FormControlLabel
                                    key={item.type}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={
                                                selectedNodeTypes.includes(
                                                    item.type,
                                                )
                                            }
                                            onChange={() =>
                                                toggleNodeType(
                                                    item.type,
                                                )
                                            }
                                            sx={{
                                                color:
                                                    entityTypeColor(
                                                        item.type,
                                                    ),
                                                "&.Mui-checked": {
                                                    color:
                                                        entityTypeColor(
                                                            item.type,
                                                        ),
                                                },
                                            }}
                                        />
                                    }
                                    label={
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent:
                                                    "space-between",
                                                gap: 1,
                                                width: "100%",
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                            >
                                                {item.type}
                                            </Typography>

                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {item.count.toLocaleString()}
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{
                                        m: 0,
                                        width: "100%",
                                        "& .MuiFormControlLabel-label": {
                                            flex: 1,
                                        },
                                    }}
                                />
                            ),
                        )}
                    </Box>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: "block",
                            mt: 1.25,
                            mb: 0.5,
                        }}
                    >
                        Visible relationship types
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gap: 0.25,
                            maxHeight: 190,
                            overflowY: "auto",
                            pr: 0.25,
                        }}
                    >
                        {relationshipTypeCounts.map(
                            (item) => (
                                <FormControlLabel
                                    key={item.type}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={
                                                selectedRelationshipTypes.includes(
                                                    item.type,
                                                )
                                            }
                                            onChange={() =>
                                                toggleRelationshipType(
                                                    item.type,
                                                )
                                            }
                                        />
                                    }
                                    label={
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent:
                                                    "space-between",
                                                gap: 1,
                                                width: "100%",
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    overflowWrap: "anywhere",
                                                }}
                                            >
                                                {item.type}
                                            </Typography>

                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {item.count.toLocaleString()}
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{
                                        m: 0,
                                        width: "100%",
                                        "& .MuiFormControlLabel-label": {
                                            flex: 1,
                                        },
                                    }}
                                />
                            ),
                        )}
                    </Box>
                </AccordionDetails>
            </Accordion>

            <Accordion
                disableGutters
                sx={accordionSx}
            >
                <AccordionSummary
                    expandIcon={
                        <ExpandIndicator />
                    }
                    sx={summarySx}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        Map and timeline
                    </Typography>
                </AccordionSummary>

                <AccordionDetails
                    sx={{
                        px: 1.25,
                        pt: 1,
                        pb: 1.25,
                    }}
                >
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={
                                    showSurroundingClusters
                                }
                                onChange={(
                                    event,
                                ) =>
                                    onShowSurroundingClustersChange(
                                        event.target.checked,
                                    )
                                }
                            />
                        }
                        label="Show surrounding clusters"
                        sx={{
                            mb: 1,
                        }}
                    />

                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Timeline aggregation"
                        value={
                            timelineBinSize
                        }
                        onChange={(
                            event,
                        ) =>
                            onTimelineBinSizeChange(
                                Number(
                                    event.target.value,
                                ) as 1 | 5 | 10,
                            )
                        }
                    >
                        <MenuItem value={1}>
                            One year
                        </MenuItem>
                        <MenuItem value={5}>
                            Five years
                        </MenuItem>
                        <MenuItem value={10}>
                            Ten years
                        </MenuItem>
                    </TextField>
                </AccordionDetails>
            </Accordion>

            <Button
                fullWidth
                variant="outlined"
                onClick={onReset}
                sx={{
                    mt: 1,
                }}
            >
                Reset Artist analysis
            </Button>
        </Box>
    );
}
