import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { useCallback, type ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";

import { getJson } from "../api/http";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { EmbeddingModelContext, type ModelCatalog } from "./EmbeddingModelContext";

export function EmbeddingModelProvider({ children }: { children: ReactNode }) {
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const request = useCallback((signal: AbortSignal) => getJson<ModelCatalog>("/models", signal), []);
    const { data, error, loading, reload } = useAsyncResource(request);
    const models = data?.models ?? [];
    const requested = (params.get("model") ?? data?.default ?? "rotate").toLowerCase();
    const selected = models.find((entry) => entry.id === requested && entry.available)
        ?? models.find((entry) => entry.id === data?.default && entry.available)
        ?? models.find((entry) => entry.available);
    if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress aria-label="Loading embedding models" /></Box>;
    if (error || !data) return (
        <Box sx={{ p: 3 }}>
            <Alert severity="error">{error ?? "Embedding models are unavailable."}</Alert>
            <Button sx={{ mt: 1.5 }} variant="outlined" onClick={reload}>Retry</Button>
        </Box>
    );

    if (!selected) return <Alert severity="error">No embedding model data are available.</Alert>;
    if (params.get("model") !== selected.id) {
        const normalized = new URLSearchParams(params);
        normalized.set("model", selected.id);
        return <Navigate replace to={{ pathname: location.pathname, search: normalized.toString() }} />;
    }

    const selectModel = (model: string) => {
        if (!data.models.some((entry) => entry.id === model && entry.available)) return;
        const next = new URLSearchParams({ model });
        if (params.get("view") === "3d") next.set("view", "3d");
        setParams(next);
    };

    return (
        <EmbeddingModelContext.Provider key={selected.id} value={{ model: selected.id, models: data.models, selectModel }}>
            {children}
        </EmbeddingModelContext.Provider>
    );
}
