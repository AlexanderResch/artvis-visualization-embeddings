from __future__ import annotations

import csv
from functools import lru_cache
import os
from pathlib import Path
import re
from typing import Any

from fastapi import HTTPException

from app.ml.utils import json_safe


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
    "creatordate",
    "creatorDate",
    "displaydate",
    "displayDate",
)

ITEM_LABELS = (
    "Item",
    "Artwork",
    "Work",
)

CREATION_RELATION_TOKENS = (
    "CREAT",
    "MADE",
    "AUTHOR",
    "ARTIST_OF",
    "PRODUC",
    "DESIGN",
)


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


def _display_name(
        properties: dict[str, Any],
        fallback: str,
) -> str:
    for key in (
            "title",
            "name",
            "label",
            "sortname",
            "display_name",
            "object_name",
            "objectName",
    ):
        value = _clean_text(properties.get(key))
        if value:
            return value

    return fallback


def _configured_item_relationships() -> list[str]:
    raw_value = os.getenv(
        "ARTVIS_CREATED_ITEM_RELATIONSHIPS",
        "",
    )

    return [
        value.strip().upper()
        for value in raw_value.split(",")
        if value.strip()
    ]


def _resolve_item_relationships(
        session: Any,
        artist_element_id: str,
) -> tuple[list[str], str | None]:
    records = session.run(
        """
        MATCH (artist:Artist)
        WHERE elementId(artist) = $artist_element_id
        MATCH (artist)-[relationship]-(item)
        WHERE any(
            label IN labels(item)
            WHERE label IN $item_labels
        )
        RETURN DISTINCT type(relationship) AS relation
        ORDER BY relation
        """,
        artist_element_id=artist_element_id,
        item_labels=list(ITEM_LABELS),
    )

    available = [
        str(record["relation"])
        for record in records
        if record["relation"]
    ]

    configured = _configured_item_relationships()
    if configured:
        selected = [
            relation
            for relation in available
            if relation.upper() in configured
        ]

        if selected:
            return selected, None

        return [], (
            "No Artist–Item relationship matched the configured creation "
            "relationship types."
        )

    semantic_matches = [
        relation
        for relation in available
        if any(
            token in relation.upper()
            for token in CREATION_RELATION_TOKENS
        )
    ]

    if semantic_matches:
        return semantic_matches, None

    if len(available) == 1:
        return available, None

    if not available:
        return [], None

    return [], (
        "Several Artist–Item relationship types exist, but none can be "
        "identified safely as a creation relationship. Configure "
        "ARTVIS_CREATED_ITEM_RELATIONSHIPS to list the valid types."
    )


def fetch_created_items(
        session: Any,
        artist_element_id: str,
        limit: int = 500,
) -> tuple[list[dict[str, Any]], list[str], str | None]:
    relationship_types, note = _resolve_item_relationships(
        session,
        artist_element_id,
    )

    if not relationship_types:
        return [], relationship_types, note

    records = session.run(
        """
        MATCH (artist:Artist)
        WHERE elementId(artist) = $artist_element_id
        MATCH (artist)-[relationship]-(item)
        WHERE type(relationship) IN $relationship_types
          AND any(
              label IN labels(item)
              WHERE label IN $item_labels
          )
        WITH
            item,
            collect(DISTINCT type(relationship)) AS relation_types
        RETURN
            elementId(item) AS item_key,
            labels(item) AS item_labels,
            properties(item) AS item_properties,
            relation_types
        ORDER BY toLower(
            coalesce(
                item.title,
                item.name,
                item.label,
                item.object_name,
                item.objectName,
                "Untitled item"
            )
        )
        LIMIT $limit
        """,
        artist_element_id=artist_element_id,
        relationship_types=relationship_types,
        item_labels=list(ITEM_LABELS),
        limit=limit,
    )

    items: list[dict[str, Any]] = []

    for record in records:
        properties = dict(record["item_properties"] or {})
        labels = list(record["item_labels"] or [])
        item_key = str(record["item_key"])
        item_type = labels[0] if labels else "Item"

        items.append({
            "id": _entity_id(item_key, properties),
            "name": _display_name(
                properties,
                "Untitled item",
            ),
            "relations": sorted(
                str(value)
                for value in (record["relation_types"] or [])
            ),
            "year": _extract_year(properties),
            "type": item_type,
        })

    return items, relationship_types, note


def _catalogue_entries_path() -> Path | None:
    configured = _clean_text(
        os.getenv("ARTVIS_CATALOGUE_ENTRIES_CSV")
    )

    candidates: list[Path] = []
    if configured:
        candidates.append(Path(configured))

    # Local development from the repository.
    candidates.append(
        Path(__file__).resolve().parents[3]
        / "artvis-graph-db"
        / "csv"
        / "catalogue_entries.csv"
    )

    # Docker Compose mounts the source file here.
    candidates.append(
        Path("/app/data/catalogue_entries.csv")
    )

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    return None


def _normalise_csv_value(value: Any) -> str:
    text = _clean_text(value)
    if text == r"\N":
        return ""
    return text


@lru_cache(maxsize=1)
def _catalogue_entries_by_artist() -> dict[str, tuple[dict[str, str], ...]]:
    path = _catalogue_entries_path()
    if path is None:
        return {}

    grouped: dict[str, list[dict[str, str]]] = {}

    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        reader = csv.DictReader(
            handle,
            delimiter=";",
        )

        for row in reader:
            artist_id = _normalise_csv_value(
                row.get("id_person")
            )
            exhibition_id = _normalise_csv_value(
                row.get("id_exhibition")
            )

            if not artist_id or not exhibition_id:
                continue

            grouped.setdefault(artist_id, []).append({
                "id": _normalise_csv_value(row.get("id")),
                "item_id": _normalise_csv_value(row.get("id_item")),
                "artist_id": artist_id,
                "exhibition_id": exhibition_id,
                "catalogue_id": _normalise_csv_value(row.get("catalogueId")),
                "type": _normalise_csv_value(row.get("type")),
                "title": _normalise_csv_value(row.get("title")),
                "displaycreator": _normalise_csv_value(row.get("displaycreator")),
                "displaydate": _normalise_csv_value(row.get("displaydate")),
                "measurements": _normalise_csv_value(row.get("measurements")),
                "technique": _normalise_csv_value(row.get("technique")),
                "style": _normalise_csv_value(row.get("style")),
            })

    return {
        artist_id: tuple(entries)
        for artist_id, entries in grouped.items()
    }


def _catalogue_sort_key(entry: dict[str, str]) -> tuple[Any, ...]:
    exhibition_id = entry.get("exhibition_id", "")
    catalogue_id = entry.get("catalogue_id", "")

    def numeric_prefix(value: str) -> tuple[int, str]:
        match = re.match(r"^(\d+)", value)
        return (
            int(match.group(1)) if match else 10**12,
            value.casefold(),
        )

    return (
        numeric_prefix(exhibition_id),
        numeric_prefix(catalogue_id),
        entry.get("title", "").casefold(),
        entry.get("id", ""),
    )


def fetch_exhibited_artworks(
        session: Any,
        artist_element_id: str,
        limit: int = 500,
) -> tuple[list[dict[str, Any]], str | None]:
    artist_record = session.run(
        """
        MATCH (artist:Artist)
        WHERE elementId(artist) = $artist_element_id
        RETURN toString(artist.id) AS artist_id
        """,
        artist_element_id=artist_element_id,
    ).single()

    if artist_record is None:
        return [], "Artist not found while loading exhibited artworks."

    artist_id = _clean_text(artist_record["artist_id"])
    if not artist_id:
        return [], (
            "The Artist has no ArtVis id, so catalogue entries cannot be "
            "matched reliably."
        )

    entries_by_artist = _catalogue_entries_by_artist()
    if not entries_by_artist:
        return [], (
            "Catalogue-entry data is unavailable. Make sure "
            "artvis-graph-db/csv/catalogue_entries.csv is present or set "
            "ARTVIS_CATALOGUE_ENTRIES_CSV."
        )

    all_entries = sorted(
        entries_by_artist.get(artist_id, ()),
        key=_catalogue_sort_key,
    )

    truncated = len(all_entries) > limit
    selected_entries = all_entries[:limit]

    exhibition_ids = sorted({
        entry["exhibition_id"]
        for entry in selected_entries
        if entry.get("exhibition_id")
    })

    exhibition_records = session.run(
        """
        MATCH (exhibition:Exhibition)
        WHERE toString(exhibition.id) IN $exhibition_ids
        OPTIONAL MATCH (exhibition)-[:TOOK_PLACE_AT]-(location:Location)
        WITH
            exhibition,
            [
                value IN collect(DISTINCT CASE
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
                WHERE value IS NOT NULL
            ] AS locations
        RETURN
            toString(exhibition.id) AS exhibition_id,
            elementId(exhibition) AS exhibition_key,
            properties(exhibition) AS exhibition_properties,
            locations
        """,
        exhibition_ids=exhibition_ids,
    )

    exhibition_context: dict[str, dict[str, Any]] = {}
    for record in exhibition_records:
        exhibition_properties = dict(
            record["exhibition_properties"] or {}
        )
        exhibition_id = _clean_text(
            record["exhibition_id"]
        )
        if not exhibition_id:
            continue

        exhibition_context[exhibition_id] = {
            "id": _entity_id(
                str(record["exhibition_key"]),
                exhibition_properties,
            ),
            "name": _display_name(
                exhibition_properties,
                f"Exhibition {exhibition_id}",
            ),
            "year": _extract_year(
                exhibition_properties
            ),
            "locations": json_safe(
                record["locations"] or []
            ),
        }

    artworks: list[dict[str, Any]] = []

    for position, entry in enumerate(selected_entries):
        exhibition_id = entry["exhibition_id"]
        exhibition = exhibition_context.get(
            exhibition_id,
            {
                "id": exhibition_id,
                "name": f"Exhibition {exhibition_id}",
                "year": None,
                "locations": [],
            },
        )

        catalogue_id = entry.get("catalogue_id") or None
        title = entry.get("title") or ""
        name = title or (
            f"Catalogue item {catalogue_id}"
            if catalogue_id
            else "Untitled exhibited artwork"
        )

        record_id = (
            entry.get("id")
            or f"{artist_id}:{exhibition_id}:{catalogue_id or position}"
        )

        artworks.append({
            "id": record_id,
            "name": name,
            "catalogue_id": catalogue_id,
            "type": entry.get("type") or None,
            "exhibition_id": exhibition["id"],
            "exhibition_name": exhibition["name"],
            "exhibition_year": exhibition["year"],
            "locations": exhibition["locations"],
        })

    note = None
    if truncated:
        note = (
            f"Showing the first {limit} recorded exhibited artworks. "
            f"This Artist has {len(all_entries)} catalogue entries in total."
        )

    return artworks, note


def fetch_artist_exhibitions(
        session: Any,
        artist_element_id: str,
) -> list[dict[str, Any]]:
    records = session.run(
        """
        MATCH (artist:Artist)-[:EXHIBITED_AT]->(exhibition:Exhibition)
        WHERE elementId(artist) = $artist_element_id
        OPTIONAL MATCH (exhibition)-[:TOOK_PLACE_AT]-(location:Location)
        RETURN
            elementId(exhibition) AS exhibition_key,
            properties(exhibition) AS exhibition_properties,
            [value IN collect(DISTINCT CASE
                WHEN location IS NULL THEN null
                ELSE {
                    id: coalesce(toString(location.id), elementId(location)),
                    name: coalesce(location.name, location.label, "Unknown location")
                }
            END) WHERE value IS NOT NULL] AS locations
        """,
        artist_element_id=artist_element_id,
    )

    exhibitions = []
    for record in records:
        properties = dict(record["exhibition_properties"] or {})
        exhibition_key = str(record["exhibition_key"])
        exhibitions.append({
            "id": _entity_id(exhibition_key, properties),
            "name": _display_name(properties, "Untitled exhibition"),
            "year": _extract_year(properties),
            "locations": json_safe(record["locations"] or []),
        })

    return sorted(
        exhibitions,
        key=lambda item: (
            item["year"] is None,
            item["year"] or 0,
            item["name"].casefold(),
            item["id"],
        ),
    )


def fetch_artist_context(
        session: Any,
        artist_id: str,
) -> dict[str, Any]:
    artist_record = session.run(
        """
        MATCH (artist:Artist)
        WHERE toString(artist.id) = $artist_id
        RETURN
            elementId(artist) AS artist_key,
            properties(artist) AS artist_properties
        """,
        artist_id=artist_id,
    ).single()

    if artist_record is None:
        raise HTTPException(
            status_code=404,
            detail="Artist not found",
        )

    artist_key = str(artist_record["artist_key"])

    groups_record = session.run(
        """
        MATCH (artist:Artist)
        WHERE elementId(artist) = $artist_key
        OPTIONAL MATCH (artist)-[:MEMBER_OF]-(group:Group)
        RETURN [
            item IN collect(DISTINCT CASE
                WHEN group IS NULL THEN null
                ELSE {
                    id: coalesce(toString(group.id), elementId(group)),
                    name: coalesce(group.name, group.title, "Unnamed group")
                }
            END)
            WHERE item IS NOT NULL
        ] AS groups
        """,
        artist_key=artist_key,
    ).single()

    activity_record = session.run(
        """
        MATCH (artist:Artist)
        WHERE elementId(artist) = $artist_key

        CALL {
            WITH artist
            OPTIONAL MATCH (artist)-[:EXHIBITED_AT]-(exhibition:Exhibition)
            RETURN count(DISTINCT exhibition) AS exhibition_count
        }

        CALL {
            WITH artist
            OPTIONAL MATCH
                (artist)-[:EXHIBITED_AT]-(exhibition:Exhibition)
                -[:TOOK_PLACE_AT]-(location:Location)
            WITH
                location,
                count(DISTINCT exhibition) AS exhibition_count
            ORDER BY
                exhibition_count DESC,
                coalesce(location.name, location.label, toString(location.id))
            RETURN [
                item IN collect(CASE
                    WHEN location IS NULL THEN null
                    ELSE {
                        id: coalesce(toString(location.id), elementId(location)),
                        name: coalesce(
                            location.name,
                            location.label,
                            "Unknown location"
                        ),
                        exhibition_count: exhibition_count
                    }
                END)
                WHERE item IS NOT NULL
            ][0..20] AS locations
        }

        RETURN exhibition_count, locations
        """,
        artist_key=artist_key,
    ).single()

    items, item_relationship_types, items_note = fetch_created_items(
        session,
        artist_key,
    )

    exhibited_artworks, exhibited_artworks_note = fetch_exhibited_artworks(
        session,
        artist_key,
    )

    groups = json_safe(
        groups_record["groups"] if groups_record else []
    )
    locations = json_safe(
        activity_record["locations"] if activity_record else []
    )

    return {
        "artist_id": artist_id,
        "groups": groups,
        "locations": locations,
        "exhibition_count": int(
            activity_record["exhibition_count"]
            if activity_record
            else 0
        ),
        "items": items,
        "item_relationship_types": item_relationship_types,
        "items_note": items_note,
        "exhibited_artworks": exhibited_artworks,
        "exhibited_artworks_note": exhibited_artworks_note,
        "exhibitions": fetch_artist_exhibitions(session, artist_key),
    }
