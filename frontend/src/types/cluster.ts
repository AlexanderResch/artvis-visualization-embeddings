export type ClusterNamedEntity = {
    id: string;
    name: string;
};

export type ClusterLocation =
    ClusterNamedEntity & {
    exhibition_count: number;
};

export type ClusterEvidenceItem =
    ClusterNamedEntity & {
    artist_count: number;
    percentage: number;
};

export type ClusterYearSummary = {
    count: number;
    minimum: number | null;
    median: number | null;
    maximum: number | null;
};

export type ClusterHistogramBin = {
    start: number;
    end: number;
    count: number;
};

export type ClusterArtist = {
    id: string;
    entity: string;
    display_name: string;
    birth_year: number | null;
    death_year: number | null;
    membership_probability: number;
    outlier_score: number;
    similarity_to_centroid: number;
    groups: ClusterNamedEntity[];
    locations: ClusterLocation[];
    exhibition_count: number;
};

export type RepresentativeClusterArtist = {
    id: string;
    display_name: string;
    similarity_to_centroid: number;
    membership_probability: number;
};

export type ClusterInspection = {
    cluster: number;
    artist_count: number;

    statistics: {
        mean_membership_probability: number;
        mean_outlier_score: number;
        mean_similarity_to_centroid: number;
        birth_year: ClusterYearSummary;
        death_year: ClusterYearSummary;
        artists_with_recorded_group: number;
        artists_without_recorded_group: number;
    };

    birth_year_histogram:
        ClusterHistogramBin[];

    group_composition:
        ClusterEvidenceItem[];

    explanation: {
        top_artvis_groups:
            ClusterEvidenceItem[];

        top_exhibitions:
            ClusterEvidenceItem[];

        top_locations:
            ClusterEvidenceItem[];

        representative_artists:
            RepresentativeClusterArtist[];

        note: string;
    };

    artists: ClusterArtist[];
};
