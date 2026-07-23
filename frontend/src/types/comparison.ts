export type ComparisonNamedEntity = {
    id: string;
    name: string;
};

export type ComparisonExhibition =
    ComparisonNamedEntity & {
    year: number | null;
};

export type ComparisonArtist = {
    id: string;
    entity: string;
    display_name: string;

    cluster: number;
    is_noise: boolean;
    membership_probability: number;
    outlier_score: number;

    birth_year: number | null;
    death_year: number | null;
    nationality: string | null;
    gender: string | null;

    groups: ComparisonNamedEntity[];
    exhibitions: ComparisonExhibition[];
    locations: ComparisonNamedEntity[];
};

export type ComparisonDifference = {
    label: string;
    artist_a_value: string;
    artist_b_value: string;
    same: boolean;
};

export type ComparisonPathNode = {
    key: string;
    id: string;
    label: string;
    type: string;
    properties: Record<string, unknown>;
};

export type ComparisonPathLink = {
    source: string;
    target: string;
    type: string;
};

export type ComparisonShortestPath = {
    found: boolean;
    hops: number | null;
    nodes: ComparisonPathNode[];
    links: ComparisonPathLink[];
};

export type ArtistComparisonResponse = {
    artist_a: ComparisonArtist;
    artist_b: ComparisonArtist;

    embedding_similarity: number;
    same_cluster: boolean;

    common: {
        groups: ComparisonNamedEntity[];
        exhibitions: ComparisonExhibition[];
        locations: ComparisonNamedEntity[];
    };

    unique: {
        artist_a_groups: ComparisonNamedEntity[];
        artist_b_groups: ComparisonNamedEntity[];
        artist_a_exhibitions: ComparisonExhibition[];
        artist_b_exhibitions: ComparisonExhibition[];
        artist_a_locations: ComparisonNamedEntity[];
        artist_b_locations: ComparisonNamedEntity[];
    };

    differences: ComparisonDifference[];

    co_exhibited: {
        direct_relationship: boolean;
        shared_exhibition_count: number;
    };

    shortest_path: ComparisonShortestPath;
    note: string;
};
