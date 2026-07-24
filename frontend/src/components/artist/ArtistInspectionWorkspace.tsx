import {
    Alert,
    Box,
    CircularProgress,
    Typography,
} from "@mui/material";

import type {
    ArtistInspectionResponse,
} from "../../types/artistInspection";

import type {
    ArtistEmbedding2D,
} from "../../types/embedding";

import {
    ArtistActivityTimeline,
} from "./ArtistActivityTimeline";

import {
    ArtistEgoNetwork,
} from "./ArtistEgoNetwork";

import {
    ArtistTopConnections,
} from "./ArtistTopConnections";


function VisualizationSection({
                                  title,
                                  description,
                                  children,
                              }: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <Box
            sx={{
                minWidth: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                backgroundColor:
                    "background.paper",
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    px: 1.5,
                    py: 1,
                    borderBottom:
                        "1px solid",
                    borderColor: "divider",
                }}
            >
                <Typography
                    variant="subtitle1"
                    sx={{
                        fontWeight: 800,
                    }}
                >
                    {title}
                </Typography>

                <Typography
                    variant="caption"
                    color="text.secondary"
                >
                    {description}
                </Typography>
            </Box>

            {children}
        </Box>
    );
}


export function ArtistInspectionWorkspace({
                                              artist,
                                              inspection,
                                              loading,
                                              error,
                                              selectedNodeTypes,
                                              selectedRelationshipTypes,
                                              timelineBinSize,
                                              onSelectArtist,
                                          }: {
    artist: ArtistEmbedding2D;
    inspection: ArtistInspectionResponse | null;
    loading: boolean;
    error: string | null;
    selectedNodeTypes: string[];
    selectedRelationshipTypes: string[];
    timelineBinSize: 1 | 5 | 10;
    onSelectArtist: (
        artistId: string,
    ) => void;
}) {
    if (loading) {
        return (
            <Box
                sx={{
                    minHeight: 360,
                    display: "grid",
                    placeItems: "center",
                }}
            >
                <CircularProgress />
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
                <Alert severity="error">
                    {error}
                </Alert>
            </Box>
        );
    }

    if (!inspection) {
        return (
            <Box
                sx={{
                    p: 2,
                }}
            >
                <Alert severity="info">
                    Artist inspection data is not available.
                </Alert>
            </Box>
        );
    }

    return (
        <Box
            className="artist-inspection-visual-grid"
        >
            <VisualizationSection
                title={`Ego network · ${inspection.ego.depth} ${inspection.ego.depth === 1 ? "hop" : "hops"}`}
                description="Graph entities around the selected Artist. Artist nodes can be selected directly."
            >
                <ArtistEgoNetwork
                    nodes={
                        inspection.ego.nodes
                    }
                    links={
                        inspection.ego.links
                    }
                    selectedNodeTypes={
                        selectedNodeTypes
                    }
                    selectedRelationshipTypes={
                        selectedRelationshipTypes
                    }
                    onSelectArtist={
                        onSelectArtist
                    }
                />
            </VisualizationSection>

            <VisualizationSection
                title="Top connections"
                description="Entities with the highest degree in the displayed local ego network."
            >
                <ArtistTopConnections
                    items={
                        inspection.top_connections
                    }
                    selectedNodeTypes={
                        selectedNodeTypes
                    }
                    selectedRelationshipTypes={
                        selectedRelationshipTypes
                    }
                    onSelectArtist={
                        onSelectArtist
                    }
                />
            </VisualizationSection>

            <VisualizationSection
                title="Exhibition activity timeline"
                description="Dated exhibition activity aggregated over the selected time interval."
            >
                <ArtistActivityTimeline
                    years={
                        inspection.timeline.years
                    }
                    undatedCount={
                        inspection.timeline.undated_count
                    }
                    binSize={
                        timelineBinSize
                    }
                    birthYear={
                        artist.birth_year
                    }
                    deathYear={
                        artist.death_year
                    }
                />
            </VisualizationSection>
        </Box>
    );
}
