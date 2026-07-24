from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ComparisonNamedEntity(BaseModel):
    id: str
    name: str


class ComparisonExhibition(ComparisonNamedEntity):
    year: int | None = None


class ComparisonArtist(BaseModel):
    id: str
    entity: str
    display_name: str
    cluster: int
    is_noise: bool
    membership_probability: float
    outlier_score: float
    birth_year: int | None = None
    death_year: int | None = None
    nationality: str | None = None
    gender: str | None = None
    groups: list[ComparisonNamedEntity] = Field(default_factory=list)
    exhibitions: list[ComparisonExhibition] = Field(default_factory=list)
    locations: list[ComparisonNamedEntity] = Field(default_factory=list)


class ComparisonCommon(BaseModel):
    groups: list[ComparisonNamedEntity] = Field(default_factory=list)
    exhibitions: list[ComparisonExhibition] = Field(default_factory=list)
    locations: list[ComparisonNamedEntity] = Field(default_factory=list)


class ComparisonUnique(BaseModel):
    artist_a_groups: list[ComparisonNamedEntity] = Field(default_factory=list)
    artist_b_groups: list[ComparisonNamedEntity] = Field(default_factory=list)
    artist_a_exhibitions: list[ComparisonExhibition] = Field(default_factory=list)
    artist_b_exhibitions: list[ComparisonExhibition] = Field(default_factory=list)
    artist_a_locations: list[ComparisonNamedEntity] = Field(default_factory=list)
    artist_b_locations: list[ComparisonNamedEntity] = Field(default_factory=list)


class ComparisonDifference(BaseModel):
    label: str
    artist_a_value: str
    artist_b_value: str
    same: bool


class CoExhibitedSummary(BaseModel):
    direct_relationship: bool
    shared_exhibition_count: int


class ComparisonPathNode(BaseModel):
    key: str
    id: str
    label: str
    type: str
    properties: dict[str, Any] = Field(default_factory=dict)


class ComparisonPathLink(BaseModel):
    source: str
    target: str
    type: str


class ComparisonShortestPath(BaseModel):
    found: bool
    hops: int | None = None
    nodes: list[ComparisonPathNode] = Field(default_factory=list)
    links: list[ComparisonPathLink] = Field(default_factory=list)
    kind: Literal[
        "shared_exhibition",
        "shared_group",
        "shared_location",
        "general",
        "none",
    ]
    is_fallback: bool


class ArtistComparisonResponse(BaseModel):
    artist_a: ComparisonArtist
    artist_b: ComparisonArtist
    embedding_similarity: float
    same_cluster: bool
    common: ComparisonCommon
    unique: ComparisonUnique
    differences: list[ComparisonDifference] = Field(default_factory=list)
    co_exhibited: CoExhibitedSummary
    shortest_path: ComparisonShortestPath
    note: str
