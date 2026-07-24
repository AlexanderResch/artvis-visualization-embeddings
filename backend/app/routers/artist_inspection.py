from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.db import get_driver
from app.ml.utils import json_safe
from app.schemas.artist import ArtistInspectionResponse
from app.services.artist_context import fetch_created_items


router = APIRouter(
    prefix="/artist-inspection",
    tags=["Artist Inspection"],
)


YEAR_PATTERN = re.compile(r"(?<!\d)(1[5-9]\d{2}|20\d{2})(?!\d)")

DATE_PROPERTY_KEYS = (
    "year",
    "start_year",
    "startYear",
    "date",
    "startdate",
    "startDate",
    "opening_date",
    "openingDate",
    "begin",
    "from",
)


@dataclass(frozen=True)
class GraphNode:
    key: str
    entity_id: str
    node_type: str
    label: str
    depth: int
    properties: dict[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "entity_id": self.entity_id,
            "type": self.node_type,
            "label": self.label,
            "depth": self.depth,
            "properties": json_safe(self.properties),
        }


def _clean_text(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).strip()
    if text.lower() in {"", "none", "null", "nan", "undefined"}:
        return ""

    return text


def _entity_id(
        element_id: str,
        properties: dict[str, Any],
) -> str:
    return _clean_text(properties.get("id")) or element_id


def _node_type(labels: list[str] | None) -> str:
    if not labels:
        return "Entity"

    return labels[0]


def _node_label(
        node_type: str,
        properties: dict[str, Any],
        fallback: str,
) -> str:
    preferred_keys_by_type = {
        "Artist": (
            "sortname",
            "display_name",
            "name",
            "fullname",
            "firstname",
        ),
        "Exhibition": (
            "title",
            "name",
        ),
        "Group": (
            "name",
            "title",
        ),
        "Location": (
            "name",
            "label",
        ),
        "Venue": (
            "name",
            "title",
        ),
        "Organizer": (
            "name",
            "title",
        ),
    }

    candidate_keys = preferred_keys_by_type.get(
        node_type,
        (
            "name",
            "title",
            "sortname",
            "label",
        ),
    )

    for key in candidate_keys:
        value = _clean_text(properties.get(key))
        if value:
            return value

    first_name = _clean_text(properties.get("firstname"))
    last_name = _clean_text(properties.get("lastname"))
    full_name = " ".join(
        part
        for part in (first_name, last_name)
        if part
    ).strip()

    return full_name or fallback


def _graph_node(
        element_id: str,
        labels: list[str] | None,
        properties: dict[str, Any] | None,
        depth: int,
) -> GraphNode:
    safe_properties = dict(properties or {})
    node_type = _node_type(labels)
    entity_id = _entity_id(
        element_id,
        safe_properties,
    )

    return GraphNode(
        key=element_id,
        entity_id=entity_id,
        node_type=node_type,
        label=_node_label(
            node_type,
            safe_properties,
            f"Unnamed {node_type}",
        ),
        depth=depth,
        properties=safe_properties,
    )


def _extract_year(properties: dict[str, Any]) -> int | None:
    for key in DATE_PROPERTY_KEYS:
        value = properties.get(key)
        if value is None:
            continue

        if isinstance(value, (int, float)):
            year = int(value)
            if 1500 <= year <= 2099:
                return year

        match = YEAR_PATTERN.search(str(value))
        if match:
            return int(match.group(1))

    return None


def _fetch_artist(
        artist_id: str,
) -> tuple[GraphNode, dict[str, Any]]:
    query = """
    MATCH (artist:Artist)
    WHERE toString(artist.id) = $artist_id
    RETURN
        elementId(artist) AS element_id,
        labels(artist) AS labels,
        properties(artist) AS properties
    """

    with get_driver().session() as session:
        record = session.run(
            query,
            artist_id=artist_id,
        ).single()

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Artist not found",
        )

    properties = dict(record["properties"] or {})
    node = _graph_node(
        str(record["element_id"]),
        list(record["labels"] or []),
        properties,
        0,
    )

    return node, properties


def _fetch_first_hop(
        artist_element_id: str,
        limit: int,
) -> list[dict[str, Any]]:
    query = """
    MATCH (artist)
    WHERE elementId(artist) = $artist_element_id
    MATCH (artist)-[relationship]-(neighbor)
    RETURN
        elementId(artist) AS source_key,
        labels(artist) AS source_labels,
        properties(artist) AS source_properties,
        elementId(neighbor) AS target_key,
        labels(neighbor) AS target_labels,
        properties(neighbor) AS target_properties,
        type(relationship) AS relation
    ORDER BY
        labels(neighbor)[0],
        type(relationship),
        coalesce(
            neighbor.sortname,
            neighbor.name,
            neighbor.title,
            toString(neighbor.id),
            elementId(neighbor)
        )
    LIMIT $limit
    """

    with get_driver().session() as session:
        return [
            dict(record)
            for record in session.run(
                query,
                artist_element_id=artist_element_id,
                limit=limit,
            )
        ]


def _fetch_second_hop(
        artist_element_id: str,
        middle_element_ids: list[str],
        limit: int,
) -> list[dict[str, Any]]:
    if not middle_element_ids or limit <= 0:
        return []

    query = """
    UNWIND $middle_element_ids AS middle_element_id
    MATCH (middle)
    WHERE elementId(middle) = middle_element_id
    MATCH (middle)-[relationship]-(neighbor)
    WHERE elementId(neighbor) <> $artist_element_id
    RETURN
        elementId(middle) AS source_key,
        labels(middle) AS source_labels,
        properties(middle) AS source_properties,
        elementId(neighbor) AS target_key,
        labels(neighbor) AS target_labels,
        properties(neighbor) AS target_properties,
        type(relationship) AS relation
    ORDER BY
        elementId(middle),
        labels(neighbor)[0],
        type(relationship),
        coalesce(
            neighbor.sortname,
            neighbor.name,
            neighbor.title,
            toString(neighbor.id),
            elementId(neighbor)
        )
    LIMIT $limit
    """

    with get_driver().session() as session:
        return [
            dict(record)
            for record in session.run(
                query,
                artist_element_id=artist_element_id,
                middle_element_ids=middle_element_ids,
                limit=limit,
            )
        ]


def _fetch_timeline(
        artist_id: str,
) -> dict[str, Any]:
    query = """
    MATCH (artist:Artist)-[:EXHIBITED_AT]-(exhibition:Exhibition)
    WHERE toString(artist.id) = $artist_id
    OPTIONAL MATCH (exhibition)-[:TOOK_PLACE_AT]-(location:Location)
    RETURN
        elementId(exhibition) AS exhibition_key,
        properties(exhibition) AS exhibition_properties,
        [
            location_item IN collect(DISTINCT CASE
                WHEN location IS NULL THEN null
                ELSE {
                    id: coalesce(toString(location.id), elementId(location)),
                    name: coalesce(
                        location.name,
                        location.label,
                        "Unknown location"
                    )
                }
            END)
            WHERE location_item IS NOT NULL
        ][0..5] AS locations
    LIMIT 3000
    """

    with get_driver().session() as session:
        records = list(
            session.run(
                query,
                artist_id=artist_id,
            )
        )

    activities_by_year: dict[int, list[dict[str, Any]]] = defaultdict(list)
    undated_count = 0

    for record in records:
        properties = dict(
            record["exhibition_properties"]
            or {}
        )
        year = _extract_year(properties)
        exhibition_key = str(record["exhibition_key"])
        exhibition_id = _entity_id(
            exhibition_key,
            properties,
        )
        label = _node_label(
            "Exhibition",
            properties,
            "Untitled exhibition",
        )

        activity = {
            "id": exhibition_id,
            "label": label,
            "type": "Exhibition",
            "locations": json_safe(
                record["locations"]
                or []
            ),
        }

        if year is None:
            undated_count += 1
            continue

        activities_by_year[year].append(activity)

    years = [
        {
            "year": year,
            "count": len(activities),
            "activities": activities[:12],
        }
        for year, activities in sorted(
            activities_by_year.items()
        )
    ]

    return {
        "years": years,
        "undated_count": undated_count,
        "year_min": years[0]["year"] if years else None,
        "year_max": years[-1]["year"] if years else None,
        "activity_type": "Exhibition",
    }


def _fetch_items(
        artist_element_id: str,
) -> tuple[list[dict[str, Any]], str | None]:
    with get_driver().session() as session:
        items, _, note = fetch_created_items(
            session,
            artist_element_id,
        )

    return items, note


def _balanced_rows(
        rows: list[dict[str, Any]],
        limit: int,
) -> list[dict[str, Any]]:
    if limit <= 0 or not rows:
        return []

    buckets: dict[
        tuple[str, str],
        list[dict[str, Any]],
    ] = defaultdict(list)

    for row in rows:
        labels = list(
            row.get("target_labels")
            or []
        )
        node_type = labels[0] if labels else "Entity"
        relation = str(
            row.get("relation")
            or "RELATED_TO"
        )
        buckets[(node_type, relation)].append(row)

    ordered_keys = sorted(buckets)
    selected: list[dict[str, Any]] = []
    position = 0

    while len(selected) < limit:
        added = False

        for key in ordered_keys:
            bucket = buckets[key]
            if position < len(bucket):
                selected.append(bucket[position])
                added = True

                if len(selected) >= limit:
                    break

        if not added:
            break

        position += 1

    return selected


def _build_ego_graph(
        root: GraphNode,
        depth: int,
        limit: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    first_hop_limit = min(
        160,
        max(20, limit // 2),
    )

    first_hop_candidates = _fetch_first_hop(
        root.key,
        min(
            1200,
            max(
                first_hop_limit,
                first_hop_limit * 4,
                ),
        ),
    )

    first_hop_rows = _balanced_rows(
        first_hop_candidates,
        first_hop_limit,
    )

    second_hop_limit = max(
        0,
        limit - len(first_hop_rows),
        )

    middle_ids = list(dict.fromkeys(
        str(row["target_key"])
        for row in first_hop_rows
    ))

    second_hop_candidates = (
        _fetch_second_hop(
            root.key,
            middle_ids,
            min(
                1800,
                max(
                    second_hop_limit,
                    second_hop_limit * 3,
                    ),
            ),
        )
        if depth == 2
        else []
    )

    second_hop_rows = _balanced_rows(
        second_hop_candidates,
        second_hop_limit,
    )

    nodes: dict[str, GraphNode] = {
        root.key: root,
    }
    links: dict[tuple[str, str, str], dict[str, Any]] = {}

    def add_row(
            row: dict[str, Any],
            target_depth: int,
    ) -> None:
        source_key = str(row["source_key"])
        target_key = str(row["target_key"])
        relation = str(row["relation"])

        source_depth = 0 if source_key == root.key else 1
        source = _graph_node(
            source_key,
            list(row["source_labels"] or []),
            dict(row["source_properties"] or {}),
            source_depth,
        )
        target = _graph_node(
            target_key,
            list(row["target_labels"] or []),
            dict(row["target_properties"] or {}),
            target_depth,
        )

        existing_source = nodes.get(source.key)
        if existing_source is None or source.depth < existing_source.depth:
            nodes[source.key] = source

        existing_target = nodes.get(target.key)
        if existing_target is None or target.depth < existing_target.depth:
            nodes[target.key] = target

        undirected_key = (
            min(source_key, target_key),
            max(source_key, target_key),
            relation,
        )

        links[undirected_key] = {
            "source": source_key,
            "target": target_key,
            "relation": relation,
            "depth": target_depth,
        }

    for row in first_hop_rows:
        add_row(row, 1)

    for row in second_hop_rows:
        add_row(row, 2)

    node_list = [
        node.as_dict()
        for node in sorted(
            nodes.values(),
            key=lambda item: (
                item.depth,
                item.node_type,
                item.label.lower(),
            ),
        )
    ]

    link_list = list(links.values())

    return node_list, link_list


def _top_connections(
        nodes: list[dict[str, Any]],
        links: list[dict[str, Any]],
        root_key: str,
) -> list[dict[str, Any]]:
    degree = Counter()
    relation_sets: dict[str, set[str]] = defaultdict(set)

    for link in links:
        source = str(link["source"])
        target = str(link["target"])
        relation = str(link["relation"])

        degree[source] += 1
        degree[target] += 1
        relation_sets[source].add(relation)
        relation_sets[target].add(relation)

    candidates = []

    for node in nodes:
        key = str(node["key"])
        if key == root_key:
            continue

        candidates.append({
            "key": key,
            "entity_id": str(node["entity_id"]),
            "type": str(node["type"]),
            "label": str(node["label"]),
            "depth": int(node["depth"]),
            "connection_count": int(degree[key]),
            "relations": sorted(relation_sets[key]),
        })

    candidates.sort(
        key=lambda item: (
            -item["connection_count"],
            item["depth"],
            item["type"],
            item["label"].lower(),
        )
    )

    return candidates[:15]


@router.get(
    "/{artist_id}",
    response_model=ArtistInspectionResponse,
)
def get_artist_inspection(
        artist_id: str,
        depth: int = Query(default=2, ge=1, le=2),
        limit: int = Query(default=350, ge=40, le=800),
):
    root, artist_properties = _fetch_artist(
        artist_id,
    )

    nodes, links = _build_ego_graph(
        root,
        depth,
        limit,
    )

    node_type_counts = Counter(
        str(node["type"])
        for node in nodes
        if str(node["key"]) != root.key
    )

    relationship_type_counts = Counter(
        str(link["relation"])
        for link in links
    )

    items, items_note = _fetch_items(
        root.key,
    )

    return {
        "artist_id": artist_id,
        "artist": {
            "key": root.key,
            "entity_id": root.entity_id,
            "display_name": root.label,
            "properties": json_safe(
                artist_properties
            ),
        },
        "ego": {
            "depth": depth,
            "nodes": nodes,
            "links": links,
            "node_type_counts": [
                {
                    "type": node_type,
                    "count": count,
                }
                for node_type, count in sorted(
                    node_type_counts.items(),
                    key=lambda item: (
                        -item[1],
                        item[0],
                    ),
                )
            ],
            "relationship_type_counts": [
                {
                    "type": relationship_type,
                    "count": count,
                }
                for relationship_type, count in sorted(
                    relationship_type_counts.items(),
                    key=lambda item: (
                        -item[1],
                        item[0],
                    ),
                )
            ],
        },
        "top_connections": _top_connections(
            nodes,
            links,
            root.key,
        ),
        "items": items,
        "items_note": items_note,
        "timeline": _fetch_timeline(
            artist_id,
        ),
        "note": (
            "The ego network and top connections are descriptive graph context. "
            "The timeline currently represents dated exhibition activity."
        ),
    }