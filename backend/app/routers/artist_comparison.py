from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.db import get_driver


router = APIRouter(
    prefix="/artist-comparison",
    tags=["artist-comparison"],
)


DATA_DIRECTORY = Path("app/ml/data")
ARTIST_EMBEDDINGS_PATH = (
        DATA_DIRECTORY
        / "artist_embeddings.npy"
)
ARTIST_MAP_PARQUET_PATH = (
        DATA_DIRECTORY
        / "artist_map_2d.parquet"
)
ARTIST_MAP_CSV_PATH = (
        DATA_DIRECTORY
        / "artist_map_2d.csv"
)


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


DISPLAY_NAME_KEYS = (
    "display_name",
    "sortname",
    "name",
    "title",
    "label",
    "lastname",
)


def _normalise_id(
        value: Any,
) -> str:
    if value is None:
        return ""

    if isinstance(
            value,
            (int, np.integer),
    ):
        return str(int(value))

    if isinstance(
            value,
            (float, np.floating),
    ) and float(value).is_integer():
        return str(int(value))

    return str(value).strip()


def _json_value(
        value: Any,
) -> Any:
    if value is None:
        return None

    if isinstance(
            value,
            (
                    str,
                    int,
                    float,
                    bool,
            ),
    ):
        return value

    if isinstance(
            value,
            (np.integer, np.floating),
    ):
        return value.item()

    if isinstance(value, dict):
        return {
            str(key): _json_value(item)
            for key, item in value.items()
        }

    if isinstance(
            value,
            (list, tuple, set),
    ):
        return [
            _json_value(item)
            for item in value
        ]

    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except TypeError:
            pass

    return str(value)


def _first_text(
        properties: dict[str, Any],
        keys: tuple[str, ...],
) -> str | None:
    for key in keys:
        value = properties.get(key)

        if value is None:
            continue

        text = str(value).strip()

        if text:
            return text

    return None


def _artist_display_name(
        properties: dict[str, Any],
        artist_id: str,
) -> str:
    direct_name = _first_text(
        properties,
        DISPLAY_NAME_KEYS,
    )

    if direct_name:
        return direct_name

    first_name = str(
        properties.get("firstname")
        or ""
    ).strip()

    last_name = str(
        properties.get("lastname")
        or ""
    ).strip()

    combined = " ".join(
        part
        for part in (
            first_name,
            last_name,
        )
        if part
    )

    return combined or f"Artist {artist_id}"


def _entity_name(
        properties: dict[str, Any],
        entity_type: str,
        fallback_id: str,
) -> str:
    name = _first_text(
        properties,
        DISPLAY_NAME_KEYS,
    )

    return name or f"{entity_type} {fallback_id}"


def _parse_year(
        properties: dict[str, Any],
) -> int | None:
    for key in DATE_PROPERTY_KEYS:
        value = properties.get(key)

        if value is None:
            continue

        text = str(value).strip()

        if len(text) >= 4:
            candidate = text[:4]

            if candidate.lstrip("-").isdigit():
                year = int(candidate)

                if 1000 <= year <= 2100:
                    return year

        if text.isdigit():
            year = int(text)

            if 1000 <= year <= 2100:
                return year

    return None


@lru_cache(maxsize=1)
def _load_artist_map() -> pd.DataFrame:
    if ARTIST_MAP_PARQUET_PATH.exists():
        frame = pd.read_parquet(
            ARTIST_MAP_PARQUET_PATH,
        )
    elif ARTIST_MAP_CSV_PATH.exists():
        frame = pd.read_csv(
            ARTIST_MAP_CSV_PATH,
        )
    else:
        raise FileNotFoundError(
            "artist_map_2d.parquet or artist_map_2d.csv is missing",
        )

    frame = frame.copy()
    frame["id_normalized"] = frame["id"].map(
        _normalise_id,
    )

    return frame


@lru_cache(maxsize=1)
def _load_artist_embeddings() -> np.ndarray:
    if not ARTIST_EMBEDDINGS_PATH.exists():
        raise FileNotFoundError(
            "artist_embeddings.npy is missing",
        )

    embeddings = np.load(
        ARTIST_EMBEDDINGS_PATH,
        mmap_mode="r",
    )

    return np.asarray(
        embeddings,
        dtype=np.float32,
    )


def _map_row(
        artist_id: str,
) -> pd.Series:
    frame = _load_artist_map()
    matches = frame[
        frame["id_normalized"]
        == artist_id
        ]

    if matches.empty:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Artist {artist_id} is not present "
                "in the Artist embedding map"
            ),
        )

    return matches.iloc[0]


def _embedding_similarity(
        artist_a_id: str,
        artist_b_id: str,
) -> float:
    first_row = _map_row(artist_a_id)
    second_row = _map_row(artist_b_id)

    first_index = int(
        first_row["artist_index"],
    )
    second_index = int(
        second_row["artist_index"],
    )

    embeddings = _load_artist_embeddings()

    if (
            first_index < 0
            or second_index < 0
            or first_index >= embeddings.shape[0]
            or second_index >= embeddings.shape[0]
    ):
        raise HTTPException(
            status_code=500,
            detail="Artist embedding index is outside the embedding array",
        )

    first = np.asarray(
        embeddings[first_index],
        dtype=np.float64,
    )
    second = np.asarray(
        embeddings[second_index],
        dtype=np.float64,
    )

    denominator = float(
        np.linalg.norm(first)
        * np.linalg.norm(second)
    )

    if denominator <= 1e-12:
        return 0.0

    return float(
        np.dot(first, second)
        / denominator
    )


def _artist_node(
        session: Any,
        artist_id: str,
) -> tuple[str, dict[str, Any]]:
    record = session.run(
        """
        MATCH (artist:Artist)
        WHERE
            toString(artist.id) = $artist_id
            OR elementId(artist) = $artist_id

        RETURN
            elementId(artist) AS key,
            properties(artist) AS properties

        LIMIT 1
        """,
        artist_id=artist_id,
    ).single()

    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Artist {artist_id} was not found in Neo4j",
        )

    return (
        str(record["key"]),
        dict(record["properties"] or {}),
    )


def _named_entities(
        session: Any,
        artist_id: str,
        label: str,
        relationship: str,
) -> list[dict[str, str]]:
    query = f"""
    MATCH (artist:Artist)
    WHERE
        toString(artist.id) = $artist_id
        OR elementId(artist) = $artist_id

    MATCH (artist)-[:{relationship}]-(entity:{label})

    RETURN DISTINCT
        elementId(entity) AS key,
        properties(entity) AS properties
    """

    rows = session.run(
        query,
        artist_id=artist_id,
    )

    result: list[dict[str, str]] = []

    for row in rows:
        key = str(row["key"])
        properties = dict(
            row["properties"]
            or {}
        )

        result.append({
            "id": _normalise_id(
                properties.get("id")
            ) or key,
            "name": _entity_name(
                properties,
                label,
                key,
            ),
        })

    result.sort(
        key=lambda item:
        item["name"].casefold(),
    )

    return result


def _exhibitions(
        session: Any,
        artist_id: str,
) -> list[dict[str, Any]]:
    rows = session.run(
        """
        MATCH (artist:Artist)
        WHERE
            toString(artist.id) = $artist_id
            OR elementId(artist) = $artist_id

        MATCH (artist)-[:EXHIBITED_AT]-(exhibition:Exhibition)

        RETURN DISTINCT
            elementId(exhibition) AS key,
            properties(exhibition) AS properties
        """,
        artist_id=artist_id,
    )

    result: list[dict[str, Any]] = []

    for row in rows:
        key = str(row["key"])
        properties = dict(
            row["properties"]
            or {}
        )

        result.append({
            "id": _normalise_id(
                properties.get("id")
            ) or key,
            "name": _entity_name(
                properties,
                "Exhibition",
                key,
            ),
            "year": _parse_year(
                properties,
            ),
        })

    result.sort(
        key=lambda item: (
            item["year"] is None,
            item["year"] or 0,
            item["name"].casefold(),
        ),
    )

    return result


def _locations(
        session: Any,
        artist_id: str,
) -> list[dict[str, str]]:
    rows = session.run(
        """
        MATCH (artist:Artist)
        WHERE
            toString(artist.id) = $artist_id
            OR elementId(artist) = $artist_id

        MATCH
            (artist)-[:EXHIBITED_AT]-(exhibition:Exhibition)
            -[:TOOK_PLACE_AT]-(location:Location)

        RETURN DISTINCT
            elementId(location) AS key,
            properties(location) AS properties
        """,
        artist_id=artist_id,
    )

    result: list[dict[str, str]] = []

    for row in rows:
        key = str(row["key"])
        properties = dict(
            row["properties"]
            or {}
        )

        result.append({
            "id": _normalise_id(
                properties.get("id")
            ) or key,
            "name": _entity_name(
                properties,
                "Location",
                key,
            ),
        })

    result.sort(
        key=lambda item:
        item["name"].casefold(),
    )

    return result


def _row_text(
        row: pd.Series,
        key: str,
) -> str | None:
    value = row.get(key)

    if value is None or pd.isna(value):
        return None

    text = str(value).strip()

    if (
            not text
            or text.casefold()
            in {
        "nan",
        "none",
        "null",
        "undefined",
    }
    ):
        return None

    return text


def _row_float(
        row: pd.Series,
        key: str,
        default: float = 0.0,
) -> float:
    value = row.get(key)

    if value is None or pd.isna(value):
        return default

    return float(value)


def _row_int(
        row: pd.Series,
        key: str,
        default: int = -1,
) -> int:
    value = row.get(key)

    if value is None or pd.isna(value):
        return default

    return int(value)


def _map_artist_summary(
        artist_id: str,
        node_properties: dict[str, Any],
        groups: list[dict[str, str]],
        exhibitions: list[dict[str, Any]],
        locations: list[dict[str, str]],
) -> dict[str, Any]:
    row = _map_row(artist_id)

    cluster = _row_int(
        row,
        "cluster",
    )

    display_name = (
            _row_text(
                row,
                "display_name",
            )
            or _artist_display_name(
        node_properties,
        artist_id,
    )
    )

    return {
        "id": artist_id,
        "entity": (
                _row_text(
                    row,
                    "entity",
                )
                or f"Artist:{artist_id}"
        ),
        "display_name": display_name,
        "cluster": cluster,
        "is_noise": (
            bool(row.get("is_noise"))
            if pd.notna(
                row.get("is_noise")
            )
            else cluster < 0
        ),
        "membership_probability": _row_float(
            row,
            "membership_probability",
        ),
        "outlier_score": _row_float(
            row,
            "outlier_score",
        ),
        "birth_year": (
            _row_int(
                row,
                "birth_year",
            )
            if pd.notna(
                row.get("birth_year")
            )
            else None
        ),
        "death_year": (
            _row_int(
                row,
                "death_year",
            )
            if pd.notna(
                row.get("death_year")
            )
            else None
        ),
        "nationality": _row_text(
            row,
            "nationality",
        ),
        "gender": _row_text(
            row,
            "gender",
        ),
        "groups": groups,
        "exhibitions": exhibitions,
        "locations": locations,
    }


def _by_id(
        items: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    return {
        str(item["id"]): item
        for item in items
    }


def _intersection(
        first: list[dict[str, Any]],
        second: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    first_by_id = _by_id(first)
    second_ids = set(_by_id(second))

    result = [
        item
        for item_id, item
        in first_by_id.items()
        if item_id in second_ids
    ]

    return sorted(
        result,
        key=lambda item:
        str(item.get("name") or "").casefold(),
    )


def _difference(
        first: list[dict[str, Any]],
        second: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    second_ids = set(_by_id(second))

    result = [
        item
        for item in first
        if str(item["id"])
           not in second_ids
    ]

    return sorted(
        result,
        key=lambda item:
        str(item.get("name") or "").casefold(),
    )


def _text_value(
        value: Any,
) -> str:
    if value is None:
        return "Unknown"

    text = str(value).strip()
    return text or "Unknown"


def _life_years(
        artist: dict[str, Any],
) -> str:
    return (
        f"{artist['birth_year'] or '?'}"
        f"–{artist['death_year'] or '?'}"
    )


def _comparison_differences(
        artist_a: dict[str, Any],
        artist_b: dict[str, Any],
) -> list[dict[str, Any]]:
    rows = [
        (
            "Computed cluster",
            "Noise"
            if artist_a["is_noise"]
            else f"Cluster {artist_a['cluster']}",
            "Noise"
            if artist_b["is_noise"]
            else f"Cluster {artist_b['cluster']}",
        ),
        (
            "Life years",
            _life_years(artist_a),
            _life_years(artist_b),
        ),
        (
            "Nationality",
            _text_value(
                artist_a["nationality"]
            ),
            _text_value(
                artist_b["nationality"]
            ),
        ),
        (
            "Gender",
            _text_value(
                artist_a["gender"]
            ),
            _text_value(
                artist_b["gender"]
            ),
        ),
        (
            "Recorded ArtVis groups",
            str(len(artist_a["groups"])),
            str(len(artist_b["groups"])),
        ),
        (
            "Recorded exhibitions",
            str(len(artist_a["exhibitions"])),
            str(len(artist_b["exhibitions"])),
        ),
        (
            "Recorded locations",
            str(len(artist_a["locations"])),
            str(len(artist_b["locations"])),
        ),
    ]

    return [
        {
            "label": label,
            "artist_a_value": first,
            "artist_b_value": second,
            "same": first == second,
        }
        for label, first, second in rows
    ]


def _path_node(
        node: Any,
) -> dict[str, Any]:
    properties = dict(node)
    labels = sorted(node.labels)
    node_type = (
        labels[0]
        if labels
        else "Entity"
    )
    key = str(node.element_id)
    node_id = _normalise_id(
        properties.get("id")
    ) or key

    return {
        "key": key,
        "id": node_id,
        "label": _entity_name(
            properties,
            node_type,
            node_id,
        ),
        "type": node_type,
        "properties": _json_value(
            properties,
        ),
    }


# The user does not choose a hop limit in the interface.
# Internally, the search expands in safe stages. The first path found is
# therefore still the shortest path, while the database is protected from
# an unbounded traversal over the dense ArtVis graph.
SHORTEST_PATH_SEARCH_LIMITS = (
    2,
    4,
    6,
    8,
)


def _serialize_path(
        path: Any,
) -> dict[str, Any]:
    nodes = [
        _path_node(node)
        for node in path.nodes
    ]

    links = [
        {
            "source": str(
                relationship.start_node.element_id
            ),
            "target": str(
                relationship.end_node.element_id
            ),
            "type": str(
                relationship.type
            ),
        }
        for relationship in path.relationships
    ]

    return {
        "found": True,
        "hops": len(path.relationships),
        "nodes": nodes,
        "links": links,
    }


def _shortest_path(
        session: Any,
        artist_a_key: str,
        artist_b_key: str,
) -> dict[str, Any]:
    for maximum_hops in SHORTEST_PATH_SEARCH_LIMITS:
        query = f"""
        MATCH (artistA:Artist)
        WHERE elementId(artistA) = $artist_a_key

        MATCH (artistB:Artist)
        WHERE elementId(artistB) = $artist_b_key

        OPTIONAL MATCH path = shortestPath(
            (artistA)-[*..{maximum_hops}]-(artistB)
        )

        RETURN path
        """

        record = session.run(
            query,
            artist_a_key=artist_a_key,
            artist_b_key=artist_b_key,
        ).single()

        path = (
            record["path"]
            if record
            else None
        )

        if path is not None:
            return _serialize_path(
                path,
            )

    return {
        "found": False,
        "hops": None,
        "nodes": [],
        "links": [],
    }


def _has_co_exhibited_relationship(
        session: Any,
        artist_a_key: str,
        artist_b_key: str,
) -> bool:
    record = session.run(
        """
        MATCH (artistA:Artist)
        WHERE elementId(artistA) = $artist_a_key

        MATCH (artistB:Artist)
        WHERE elementId(artistB) = $artist_b_key

        RETURN EXISTS {
            MATCH
                (artistA)-[:CO_EXHIBITED]-(artistB)
        } AS connected
        """,
        artist_a_key=artist_a_key,
        artist_b_key=artist_b_key,
    ).single()

    return bool(
        record
        and record["connected"]
    )


@router.get("")
def compare_artists(
        artist_a: str = Query(
            ...,
            min_length=1,
        ),
        artist_b: str = Query(
            ...,
            min_length=1,
        ),
) -> dict[str, Any]:
    artist_a_id = artist_a.strip()
    artist_b_id = artist_b.strip()

    if artist_a_id == artist_b_id:
        raise HTTPException(
            status_code=400,
            detail="Choose two different Artists for the comparison",
        )

    try:
        embedding_similarity = _embedding_similarity(
            artist_a_id,
            artist_b_id,
        )
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error

    with get_driver().session() as session:
        artist_a_key, artist_a_properties = _artist_node(
            session,
            artist_a_id,
        )

        artist_b_key, artist_b_properties = _artist_node(
            session,
            artist_b_id,
        )

        artist_a_groups = _named_entities(
            session,
            artist_a_id,
            "Group",
            "MEMBER_OF",
        )
        artist_b_groups = _named_entities(
            session,
            artist_b_id,
            "Group",
            "MEMBER_OF",
        )

        artist_a_exhibitions = _exhibitions(
            session,
            artist_a_id,
        )
        artist_b_exhibitions = _exhibitions(
            session,
            artist_b_id,
        )

        artist_a_locations = _locations(
            session,
            artist_a_id,
        )
        artist_b_locations = _locations(
            session,
            artist_b_id,
        )

        direct_co_exhibited = _has_co_exhibited_relationship(
            session,
            artist_a_key,
            artist_b_key,
        )

        shortest_path = _shortest_path(
            session,
            artist_a_key,
            artist_b_key,
        )

    artist_a_summary = _map_artist_summary(
        artist_a_id,
        artist_a_properties,
        artist_a_groups,
        artist_a_exhibitions,
        artist_a_locations,
    )

    artist_b_summary = _map_artist_summary(
        artist_b_id,
        artist_b_properties,
        artist_b_groups,
        artist_b_exhibitions,
        artist_b_locations,
    )

    common_groups = _intersection(
        artist_a_groups,
        artist_b_groups,
    )
    common_exhibitions = _intersection(
        artist_a_exhibitions,
        artist_b_exhibitions,
    )
    common_locations = _intersection(
        artist_a_locations,
        artist_b_locations,
    )

    return {
        "artist_a": artist_a_summary,
        "artist_b": artist_b_summary,
        "embedding_similarity": embedding_similarity,
        "same_cluster": (
                artist_a_summary["cluster"]
                == artist_b_summary["cluster"]
                and not artist_a_summary["is_noise"]
                and not artist_b_summary["is_noise"]
        ),
        "common": {
            "groups": common_groups,
            "exhibitions": common_exhibitions,
            "locations": common_locations,
        },
        "unique": {
            "artist_a_groups": _difference(
                artist_a_groups,
                artist_b_groups,
            ),
            "artist_b_groups": _difference(
                artist_b_groups,
                artist_a_groups,
            ),
            "artist_a_exhibitions": _difference(
                artist_a_exhibitions,
                artist_b_exhibitions,
            ),
            "artist_b_exhibitions": _difference(
                artist_b_exhibitions,
                artist_a_exhibitions,
            ),
            "artist_a_locations": _difference(
                artist_a_locations,
                artist_b_locations,
            ),
            "artist_b_locations": _difference(
                artist_b_locations,
                artist_a_locations,
            ),
        },
        "differences": _comparison_differences(
            artist_a_summary,
            artist_b_summary,
        ),
        "co_exhibited": {
            "direct_relationship": direct_co_exhibited,
            "shared_exhibition_count": len(
                common_exhibitions,
            ),
        },
        "shortest_path": shortest_path,
        "note": (
            "Embedding similarity is calculated in the high-dimensional "
            "Artist embedding. Common graph entities and the shortest path "
            "are descriptive evidence and do not prove a causal reason for "
            "the learned similarity. A direct CO_EXHIBITED relationship can "
            "therefore appear as a one-hop shortest path."
        ),
    }
