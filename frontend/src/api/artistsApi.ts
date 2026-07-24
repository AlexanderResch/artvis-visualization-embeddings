import { buildQuery, getJson } from "./http";
import type { SimilarArtist } from "../types/dashboard";
import type { ArtistContextResponse } from "../types/artistContext";

export function fetchSimilarArtists(
    artistId: string,
    limit = 10,
    signal?: AbortSignal,
): Promise<SimilarArtist[]> {
    const query = buildQuery({ limit });
    return getJson<SimilarArtist[]>(`/artists/${artistId}/similar${query}`, signal);
}


export function fetchArtistContext(
    artistId: string,
    signal?: AbortSignal,
): Promise<ArtistContextResponse> {
    return getJson<ArtistContextResponse>(
        `/artists/${encodeURIComponent(artistId)}/context`,
        signal,
    );
}
