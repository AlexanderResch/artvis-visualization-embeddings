import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";

import type {
    ReactNode,
} from "react";
import { useEmbeddingModel } from "../../context/EmbeddingModelContext";


function HelpSection({
                         title,
                         children,
                     }: {
    title: string;
    children: ReactNode;
}) {
    return (
        <Box>
            <Typography
                variant="subtitle2"
                sx={{
                    fontWeight: 800,
                    mb: 0.35,
                }}
            >
                {title}
            </Typography>

            <Typography
                component="div"
                variant="body2"
                color="text.secondary"
                sx={{ lineHeight: 1.55 }}
            >
                {children}
            </Typography>
        </Box>
    );
}


export function ExplorerHelpDialog({
                                       open,
                                       onClose,
                                   }: {
    open: boolean;
    onClose: () => void;
}) {
    const { models } = useEmbeddingModel();
    const rankedModels = models.filter((model) => model.evaluation);
    const startingModel = models.find((model) => model.available)?.name;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            aria-labelledby="explorer-help-title"
        >
            <DialogTitle
                id="explorer-help-title"
                sx={{ pb: 1 }}
            >
                ArtVis Embedding Explorer help
            </DialogTitle>

            <DialogContent
                dividers
                sx={{
                    display: "grid",
                    gap: 1.5,
                    py: 1.5,
                }}
            >
                <HelpSection title="Choosing an embedding model">
                    <Box component="p" sx={{ mt: 0 }}>
                        {startingModel} is the starting model. The dropdown lists models by their mean validation
                        pair-F1 against recorded Neo4j Artist groups. Higher F1 means stronger agreement with those
                        groups under the tested settings. Separate test Artists are used for the test scores below.
                        The group-membership relationships are excluded from training; co-exhibition relationships
                        remain included.
                    </Box>
                    {rankedModels.length > 0 ? (
                        <TableContainer>
                            <Table size="small" aria-label="Embedding model ranking">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Rank</TableCell>
                                        <TableCell>Model</TableCell>
                                        <TableCell align="right">Test pair-F1</TableCell>
                                        <TableCell align="right">Noise</TableCell>
                                        <TableCell align="right">Seed stability</TableCell>
                                        <TableCell align="right">Starts with clusters</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rankedModels.map((model) => model.evaluation && (
                                        <TableRow key={model.id}>
                                            <TableCell>{model.rank}</TableCell>
                                            <TableCell>{model.name}</TableCell>
                                            <TableCell align="right">{model.evaluation.test_pair_f1_mean.toFixed(3)}</TableCell>
                                            <TableCell align="right">{(100 * model.evaluation.noise_fraction_mean).toFixed(1)}%</TableCell>
                                            <TableCell align="right">{model.evaluation.cross_seed_jaccard_mean?.toFixed(3) ?? "—"}</TableCell>
                                            <TableCell align="right">{model.evaluation.clustered_seeds}/{model.evaluation.completed_seeds}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Box component="p">Comparison scores are not available for this dataset.</Box>
                    )}
                    <Box component="p" sx={{ mb: 0 }}>
                        These values are means across repeated training starts. Noise is the proportion of Artists
                        without a cluster; seed stability measures how consistently clusters reappear across starts
                        (Jaccard, 0–1, higher is more consistent). Each model displays one fixed run, so the visible
                        cluster count and noise can differ from the means. The starts column shows how many runs
                        produced any clusters; all runs contribute to the noise and F1 means. F1 measures
                        agreement between Artist pairs, not the percentage of
                        correctly classified Artists. Recorded groups can overlap and be incomplete, so this
                        ranking supports model selection for this dataset rather than a universal model ranking.
                    </Box>
                </HelpSection>

                <Divider />

                <HelpSection title="What the embedding map shows">
                    Each point represents an Artist. HDBSCAN clusters are computed from the embeddings before UMAP produces the independent 2D and 3D views. The map coordinates and axis directions do not have an independent semantic meaning. Nearby points suggest similar learned graph patterns, but not necessarily a direct graph connection. Artist attributes provide context and are not used to train the embeddings.
                </HelpSection>

                <Divider />

                <HelpSection title="Switching embedding models">
                    Use Embedding model to switch between the ranked models. The map, clusters, profiles, similarities, and comparisons use the selected model. Switching models clears selections and filters, while keeping the 2D or 3D view. The selected model is stored in the page URL, so reloads and shared links retain it. Cluster numbers, colors, and map positions are specific to each model; matching numbers or colors do not identify the same group across models.
                </HelpSection>

                <Divider />

                <HelpSection title="Colors and cluster assignment">
                    Colored Artist points are part of computed HDBSCAN clusters. Gray points are not part of a cluster and are shown as Noise. The detail panels use cluster assignment strength, outlier score, and similarity to the cluster center to describe an Artist's position within a cluster.
                </HelpSection>

                <Divider />

                <HelpSection title="How to read the cluster scores">
                    Cluster assignment strength describes how strongly HDBSCAN assigns an Artist to the selected cluster; it is not a calibrated probability of historical group membership. Outlier score is the original HDBSCAN outlier score, where lower values indicate a more typical cluster position and higher values indicate a more outlier-like position. Similarity to cluster center uses the full normalized embedding features.
                </HelpSection>

                <Divider />

                <HelpSection title="Available analytical views">
                    Use the overview to filter and select Artists or clusters. Cluster inspection summarizes common characteristics and members. Artist inspection combines the embedding context with an ego network, top graph connections, and an activity timeline. Comparison mode contrasts two Artists and shows shared graph context. Its path explorer can display every returned shortest path or all returned simple paths with a selected maximum length from 2 to 5 relationships. The 3D view provides an additional spatial perspective.
                </HelpSection>

                <Divider />

                <HelpSection title="Main interactions">
                    Drag to pan in 2D, drag to rotate in 3D, and use the mouse wheel to zoom. Select a point to inspect an Artist, use the cluster selector to open a cluster, and use Fit focus to center the active selection. Reset view restores only the map camera. Reset all clears selections, filters, and view settings, and returns to the overview of the selected model. Hover or focus the question-mark button for a short hint about the current view; click it to open this help.
                </HelpSection>

                <Divider />

                <HelpSection title="Cluster comparison">
                    Use Compare clusters to select Cluster A and Cluster B. The other clusters remain visible as spatial context, while A and B are outlined. You can select Cluster B from the sidebar, by searching for a known Artist, by clicking an Artist from another cluster on the map, or by clicking a cluster in the map legend. The comparison panels show cluster size, gender distribution, exhibited artworks, Artist groups, exhibition locations, exhibitions, and representative Artists.
                </HelpSection>

                <Divider />

                <HelpSection title="Interpretation note">
                    The embedding map is an exploratory overview. Use the graph-based detail panels to examine exhibitions, groups, locations, paths, and other explicit relationships before drawing domain conclusions from spatial proximity or cluster assignment.
                </HelpSection>
            </DialogContent>

            <DialogActions sx={{ px: 2, py: 1 }}>
                <Button
                    onClick={onClose}
                    variant="contained"
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
