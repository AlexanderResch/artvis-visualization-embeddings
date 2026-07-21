import { Box, Button, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router";

export function PlaceholderPage({ title }: { title: string }) {
    const navigate = useNavigate();
    const params = useParams();

    return (
        <Box sx={{ p: 4, maxWidth: 900, mx: "auto" }}>
            <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>
                Back
            </Button>
            <Typography variant="h4" sx={{ fontWeight: 800 }} gutterBottom>
                {title}
            </Typography>
            <Typography color="text.secondary">
                This route is already wired for the later design sketches. Route parameters: {JSON.stringify(params)}
            </Typography>
        </Box>
    );
}
