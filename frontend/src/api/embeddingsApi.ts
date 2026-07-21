import { getJson } from "./http";

import type {
    ArtistEmbedding2D,
    ArtistEmbedding3D,
} from "../types/embedding";


type RawArtistEmbedding2D =
    Omit<
        ArtistEmbedding2D,
        "display_name"
    > & {
    display_name?:
        string | null;
};


type RawArtistEmbedding3D =
    Omit<
        ArtistEmbedding3D,
        "display_name"
    > & {
    display_name?:
        string | null;
};


function resolveDisplayName(
    displayName:
        string | null | undefined,

    entity:
        string | null | undefined,

    id:
    string,
): string {
    const normalizedName =
        typeof displayName === "string"
            ? displayName.trim()
            : "";

    const invalidNames =
        new Set([
            "",
            "null",
            "none",
            "nan",
            "undefined",
        ]);

    if (
        normalizedName
        && !invalidNames.has(
            normalizedName.toLowerCase()
        )
    ) {
        return normalizedName;
    }

    const normalizedEntity =
        typeof entity === "string"
            ? entity.trim()
            : "";

    if (normalizedEntity) {
        return normalizedEntity;
    }

    return `Artist ${id}`;
}


function normalizeArtist2D(
    artist: RawArtistEmbedding2D,
): ArtistEmbedding2D {
    return {
        ...artist,

        display_name:
            resolveDisplayName(
                artist.display_name,
                artist.entity,
                artist.id,
            ),
    };
}


function normalizeArtist3D(
    artist: RawArtistEmbedding3D,
): ArtistEmbedding3D {
    return {
        ...artist,

        display_name:
            resolveDisplayName(
                artist.display_name,
                artist.entity,
                artist.id,
            ),
    };
}


export async function fetchEmbeddings2D(
    signal?: AbortSignal,
): Promise<ArtistEmbedding2D[]> {
    const artists =
        await getJson<
            RawArtistEmbedding2D[]
        >(
            "/embeddings/2d",
            signal,
        );

    return artists.map(
        normalizeArtist2D
    );
}


export async function fetchEmbeddings3D(
    signal?: AbortSignal,
): Promise<ArtistEmbedding3D[]> {
    const artists =
        await getJson<
            RawArtistEmbedding3D[]
        >(
            "/embeddings/3d",
            signal,
        );

    return artists.map(
        normalizeArtist3D
    );
}