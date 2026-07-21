import { buildQuery, getJson } from "./http";
import type { SimilarArtist } from "../types/dashboard";

export function fetchSimilarArtists(
    artistId: string,
    limit = 10,
    signal?: AbortSignal,
): Promise<SimilarArtist[]> {
    const query = buildQuery({ limit });
    return getJson<SimilarArtist[]>(`/artists/${artistId}/similar${query}`, signal);
}
