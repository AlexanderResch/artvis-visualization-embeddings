import {
    buildQuery,
    getJson,
} from "./http";

import type {
    ArtistInspectionResponse,
} from "../types/artistInspection";


export function fetchArtistInspection(
    artistId: string,
    depth = 2,
    limit = 350,
    signal?: AbortSignal,
): Promise<ArtistInspectionResponse> {
    const query = buildQuery({
        depth,
        limit,
    });

    return getJson<ArtistInspectionResponse>(
        `/artist-inspection/${encodeURIComponent(artistId)}${query}`,
        signal,
    );
}
