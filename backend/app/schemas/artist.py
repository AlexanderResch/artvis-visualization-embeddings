from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class NamedEntity(BaseModel):
    id: str
    name: str


class ArtistLocation(NamedEntity):
    exhibition_count: int = 0


class ArtistCreatedItem(BaseModel):
    id: str
    name: str
    relations: list[str] = Field(default_factory=list)
    year: int | None = None
    type: str


class ArtistContextResponse(BaseModel):
    artist_id: str
    groups: list[NamedEntity] = Field(default_factory=list)
    locations: list[ArtistLocation] = Field(default_factory=list)
    exhibition_count: int = 0
    items: list[ArtistCreatedItem] = Field(default_factory=list)
    item_relationship_types: list[str] = Field(default_factory=list)
    items_note: str | None = None


class ArtistInspectionNode(BaseModel):
    key: str
    entity_id: str
    type: str
    label: str
    depth: int
    properties: dict[str, Any] = Field(default_factory=dict)


class ArtistInspectionLink(BaseModel):
    source: str
    target: str
    relation: str
    depth: int


class CountItem(BaseModel):
    type: str
    count: int


class ArtistTopConnection(BaseModel):
    key: str
    entity_id: str
    type: str
    label: str
    depth: int
    connection_count: int
    relations: list[str] = Field(default_factory=list)


class TimelineLocation(BaseModel):
    id: str
    name: str


class TimelineActivity(BaseModel):
    id: str
    label: str
    type: str
    locations: list[TimelineLocation] = Field(default_factory=list)


class TimelineYear(BaseModel):
    year: int
    count: int
    activities: list[TimelineActivity] = Field(default_factory=list)


class TimelineResponse(BaseModel):
    years: list[TimelineYear] = Field(default_factory=list)
    undated_count: int
    year_min: int | None = None
    year_max: int | None = None
    activity_type: str


class InspectionArtist(BaseModel):
    key: str
    entity_id: str
    display_name: str
    properties: dict[str, Any] = Field(default_factory=dict)


class EgoResponse(BaseModel):
    depth: int
    nodes: list[ArtistInspectionNode] = Field(default_factory=list)
    links: list[ArtistInspectionLink] = Field(default_factory=list)
    node_type_counts: list[CountItem] = Field(default_factory=list)
    relationship_type_counts: list[CountItem] = Field(default_factory=list)


class ArtistInspectionResponse(BaseModel):
    artist_id: str
    artist: InspectionArtist
    ego: EgoResponse
    top_connections: list[ArtistTopConnection] = Field(default_factory=list)
    items: list[ArtistCreatedItem] = Field(default_factory=list)
    items_note: str | None = None
    timeline: TimelineResponse
    note: str
