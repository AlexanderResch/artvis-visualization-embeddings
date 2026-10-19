import {
    Alert,
    Box,
    CircularProgress,
    Typography,
} from "@mui/material";

import type {
    ArtistComparisonResponse,
} from "../../types/comparison";

import {
    CommonEntityList,
} from "./CommonEntityList";

import {
    ComparisonPathExplorer,
} from "./ComparisonPathExplorer";


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
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 800 }}
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


export function ComparisonWorkspace({
                                        comparison,
                                        loading,
                                        error,
                                        showEdgeLabels,
                                        onSelectArtist,
                                    }: {
    comparison: ArtistComparisonResponse | null;
    loading: boolean;
    error: string | null;
    showEdgeLabels: boolean;
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
            <Box sx={{ p: 2 }}>
                <Alert severity="error">
                    {error}
                </Alert>
            </Box>
        );
    }

    if (!comparison) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info">
                    Select two different Artists to load their comparison.
                </Alert>
            </Box>
        );
    }

    return (
        <Box className="comparison-visual-grid">
            <VisualizationSection
                title={`Common Artist groups · ${comparison.common.groups.length}`}
                description="Artist group entities connected to both Artists."
            >
                <CommonEntityList
                    items={comparison.common.groups}
                    emptyText="The compared Artists do not share a recorded Artist group."
                />
            </VisualizationSection>

            <VisualizationSection
                title={`Common exhibitions · ${comparison.common.exhibitions.length}`}
                description="Recorded Exhibition entities connected to both Artists."
            >
                <CommonEntityList
                    items={
                        comparison.common.exhibitions
                    }
                    emptyText="The compared Artists do not share a recorded Exhibition."
                />
            </VisualizationSection>

            <VisualizationSection
                title="Connecting paths"
                description="Inspect all shortest paths or simple paths containing 2 to 5 relationships, with a separate result quota for each length."
            >
                <ComparisonPathExplorer
                    artistAId={comparison.artist_a.id}
                    artistBId={comparison.artist_b.id}
                    showEdgeLabels={
                        showEdgeLabels
                    }
                    onSelectArtist={
                        onSelectArtist
                    }
                />
            </VisualizationSection>
        </Box>
    );
}
