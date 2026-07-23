export type ArtistInspectionNode = {
    key: string;
    entity_id: string;
    type: string;
    label: string;
    depth: number;
    properties: Record<string, unknown>;
};

export type ArtistInspectionLink = {
    source: string;
    target: string;
    relation: string;
    depth: number;
};

export type ArtistInspectionNodeTypeCount = {
    type: string;
    count: number;
};

export type ArtistTopConnection = {
    key: string;
    entity_id: string;
    type: string;
    label: string;
    depth: number;
    connection_count: number;
    relations: string[];
};

export type ArtistTimelineActivity = {
    id: string;
    label: string;
    type: "Exhibition" | string;
    locations: Array<{
        id: string;
        name: string;
    }>;
};

export type ArtistTimelineYear = {
    year: number;
    count: number;
    activities: ArtistTimelineActivity[];
};

export type ArtistCreatedItem = {
    id: string;
    name: string;
    relation: string;
    year: number | null;
    type: string;
};


export type ArtistInspectionResponse = {
    artist_id: string;
    artist: {
        key: string;
        entity_id: string;
        display_name: string;
        properties: Record<string, unknown>;
    };
    ego: {
        depth: number;
        nodes: ArtistInspectionNode[];
        links: ArtistInspectionLink[];
        node_type_counts: ArtistInspectionNodeTypeCount[];
    };
    top_connections: ArtistTopConnection[];
    items: ArtistCreatedItem[];
    timeline: {
        years: ArtistTimelineYear[];
        undated_count: number;
        year_min: number | null;
        year_max: number | null;
        activity_type: string;
    };
    note: string;
};
