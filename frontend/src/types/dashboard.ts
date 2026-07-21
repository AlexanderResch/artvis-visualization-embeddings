export type CountOption = {
    id: string;
    name: string;
    artist_count: number;
};

export type ClusterOption = {
    cluster: number;
    artist_count: number;
    is_noise: boolean;
};

export type HistogramBin = {
    start: number;
    end: number;
    count: number;
};

export type DashboardOverview = {
    artist_count: number;
    cluster_count: number;
    group_count: number;
    location_count: number;

    noise_count: number;
    noise_fraction: number;

    birth_year_min: number | null;
    birth_year_max: number | null;
};

export type DashboardOptions = {
    overview: DashboardOverview;
    clusters: ClusterOption[];
    groups: CountOption[];
    locations: CountOption[];
    birth_year_histogram: HistogramBin[];
};

export type NamedEntitySummary = {
    id: string;
    name: string;
};

export type SimilarArtist = {
    id: string;
    entity: string;
    display_name: string;

    similarity: number;

    cluster: number;
    is_noise: boolean;
    membership_probability: number;

    birth_year: number | null;
    death_year: number | null;

    common_groups: NamedEntitySummary[];
    common_exhibitions: NamedEntitySummary[];
    common_locations: NamedEntitySummary[];
};