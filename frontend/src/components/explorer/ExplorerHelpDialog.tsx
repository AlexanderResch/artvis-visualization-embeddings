import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Typography,
} from "@mui/material";

import type {
    ReactNode,
} from "react";


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
                <HelpSection title="What the embedding map shows">
                    Each point represents an Artist. Point positions are produced by a UMAP projection of the PCA-reduced Artist embeddings. The map coordinates and axis directions do not have an independent semantic meaning. Nearby points indicate similar learned graph-and-attribute patterns, but not necessarily a direct graph connection.
                </HelpSection>

                <Divider />

                <HelpSection title="Colors and cluster membership">
                    Colored Artist points belong to HDBSCAN clusters. Gray points are classified as Noise. The legend above the map lists the selected clusters and the largest clusters currently visible in the viewport. Cluster membership probability and outlier information are available in the detail panels.
                </HelpSection>

                <Divider />

                <HelpSection title="Available analytical views">
                    Use the overview to filter and select Artists or clusters. Cluster inspection summarizes common characteristics and members. Artist inspection combines the embedding context with an ego network, top graph connections, and an activity timeline. Comparison mode contrasts two Artists and shows shared graph context and connecting paths. The 3D view provides an additional spatial perspective.
                </HelpSection>

                <Divider />

                <HelpSection title="Main interactions">
                    Drag to pan in 2D, drag to rotate in 3D, and use the mouse wheel to zoom. Select a point to inspect an Artist, use the cluster selector to open a cluster, and use Fit focus to center the active selection. Reset view restores only the map camera. Reset all clears selections, filters, view settings, and returns to the default overview.
                </HelpSection>

                <Divider />

                <HelpSection title="Interpretation note">
                    The embedding map is an exploratory overview. Use the graph-based detail panels to examine exhibitions, groups, locations, paths, and other explicit relationships before drawing domain conclusions from spatial proximity or cluster membership.
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
