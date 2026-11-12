import { useMemo } from "react";

import { fetchArtistContext } from "../api/artistsApi";
import type { ArtistContextResponse } from "../types/artistContext";
import { useAsyncResource } from "./useAsyncResource";


type ArtistContextState = {
    context: ArtistContextResponse | null;
    loading: boolean;
    error: string | null;
};


export function useArtistContext(
    artistId: string | null,
    enabled: boolean,
): ArtistContextState {
    const request = useMemo(() => {
        if (!artistId || !enabled) return null;
        return (signal: AbortSignal) => fetchArtistContext(artistId, signal);
    }, [artistId, enabled]);

    const { data, loading, error } = useAsyncResource(request);
    return { context: data, loading, error };
}
