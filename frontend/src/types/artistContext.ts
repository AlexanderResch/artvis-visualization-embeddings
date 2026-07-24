import type {
    ArtistCreatedItem,
} from "./artistInspection";

export type ArtistContextNamedEntity = {
    id: string;
    name: string;
};

export type ArtistContextLocation =
    ArtistContextNamedEntity & {
    exhibition_count: number;
};

export type ArtistContextResponse = {
    artist_id: string;
    groups: ArtistContextNamedEntity[];
    locations: ArtistContextLocation[];
    exhibition_count: number;
    items: ArtistCreatedItem[];
    item_relationship_types: string[];
    items_note: string | null;
};
