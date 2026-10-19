import {
    buildQuery,
    getJson,
} from "./http";

import type {
    ComparisonConnectingPaths,
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


export function fetchArtistConnectingPaths(
    artistAId: string,
    artistBId: string,
    maxHops: 2 | 3 | 4 | 5,
    signal?: AbortSignal,
): Promise<ComparisonConnectingPaths> {
    const query = buildQuery({
        artist_a: artistAId,
        artist_b: artistBId,
        max_hops: maxHops,
    });

    return getJson<ComparisonConnectingPaths>(
        `/artist-comparison/paths${query}`,
        signal,
    );
}
