export type ViewMode = "2d" | "3d";

export type ArtistEmbeddingBase = {
    artist_index: number;
    entity: string;
    type: "Artist";
    id: string;
    display_name: string | null;

    birth_year: number | null;
    death_year: number | null;
    nationality: string | null;
    gender: string | null;

    cluster: number;
    is_noise: boolean;

    membership_probability: number;
    outlier_score: number;
};

export type ArtistEmbedding2D =
    ArtistEmbeddingBase & {
    x: number;
    y: number;
};

export type ArtistEmbedding3D =
    ArtistEmbeddingBase & {
    x: number;
    y: number;
    z: number;
};