import {
    buildQuery,
    getJson,
} from "./http";

import type {
    ArtistComparisonResponse,
} from "../types/comparison";


export function fetchArtistComparison(
    artistAId: string,
    artistBId: string,
    signal?: AbortSignal,
): Promise<ArtistComparisonResponse> {
    const query = buildQuery({
        artist_a: artistAId,
        artist_b: artistBId,
    });

    return getJson<ArtistComparisonResponse>(
        `/artist-comparison${query}`,
        signal,
    );
}
