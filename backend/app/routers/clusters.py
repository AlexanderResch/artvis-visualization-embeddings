from collections import Counter
from functools import lru_cache

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.db import get_driver
from app.ml.config import (
    ARTIST_CLUSTERS_PATH,
    ARTIST_EMBEDDINGS_PATH,
    CLUSTER_PROFILES_PATH,
    HDBSCAN_CANDIDATES_PATH,
    HDBSCAN_SUMMARY_PATH,
)
from app.ml.utils import json_safe, read_json

router = APIRouter(
    prefix="/clusters",
    tags=["Artist clusters"],
)

TOP_EXPLANATION_ITEMS = 10
TOP_ARTIST_LOCATIONS = 3
REPRESENTATIVE_ARTISTS = 8


def _clean_name(
        value,
        fallback: str,
) -> str:
    if value is None or pd.isna(value):
        return fallback

    text = str(value).strip()

    if text.lower() in {
        "",
        "null",
        "none",
        "nan",
        "undefined",
    }:
        return fallback

    return text


def _optional_int(value) -> int | None:
    if value is None or pd.isna(value):
        return None

    return int(value)


def _birth_year_histogram(
        years: pd.Series,
        bin_size: int = 10,
) -> list[dict]:
    clean_years = pd.to_numeric(
        years,
        errors="coerce",
    ).dropna()

    if clean_years.empty:
        return []

    clean_years = clean_years.astype(int)

    start = (
            int(clean_years.min())
            // bin_size
            * bin_size
    )

    stop = (
                   (
                           int(clean_years.max())
                           // bin_size
                   )
                   + 1
           ) * bin_size

    return [
        {
            "start": lower,
            "end": lower + bin_size - 1,
            "count": int(
                (
                        (clean_years >= lower)
                        & (
                                clean_years
                                <= lower + bin_size - 1
                        )
                ).sum()
            ),
        }
        for lower in range(
            start,
            stop,
            bin_size,
        )
    ]


def _load_group_memberships(
        artist_ids: list[str],
) -> dict[str, list[dict]]:
    if not artist_ids:
        return {}

    query = """
    UNWIND $artist_ids AS requested_id

    MATCH (artist:Artist)

    WHERE
        toString(artist.id)
        = requested_id

    OPTIONAL MATCH
        (artist)
        -[:MEMBER_OF]->
        (group:Group)

    WITH
        requested_id,

        [
            item IN collect(
                DISTINCT CASE
                    WHEN group IS NULL
                    THEN null

                    ELSE {
                        id:
                            toString(group.id),

                        name:
                            coalesce(
                                group.name,
                                toString(group.id)
                            )
                    }
                END
            )

            WHERE item IS NOT NULL
        ] AS groups

    RETURN
        requested_id AS artist_id,
        groups
    """

    with get_driver().session() as session:
        records = session.run(
            query,
            artist_ids=artist_ids,
        )

        return {
            str(record["artist_id"]): json_safe(
                record["groups"] or []
            )
            for record in records
        }


def _load_artist_activity_context(
        artist_ids: list[str],
) -> dict[str, dict]:
    if not artist_ids:
        return {}

    query = f"""
    UNWIND $artist_ids AS requested_id

    MATCH (artist:Artist)

    WHERE
        toString(artist.id)
        = requested_id

    CALL {{
        WITH artist

        OPTIONAL MATCH
            (artist)
            -[exhibited_at:EXHIBITED_AT]->
            (exhibition:Exhibition)

        RETURN
            count(
                DISTINCT exhibition
            ) AS exhibition_count,

            count(exhibited_at)
                AS exhibited_item_count
    }}

    CALL {{
        WITH artist

        OPTIONAL MATCH
            (artist)
            -[:EXHIBITED_AT]->
            (exhibition:Exhibition)
            -[:TOOK_PLACE_AT]->
            (location:Location)

        WITH
            location,

            count(
                DISTINCT exhibition
            ) AS exhibition_count

        ORDER BY
            exhibition_count DESC,
            coalesce(
                location.name,
                toString(location.id)
            )

        WITH [
            item IN collect(
                CASE
                    WHEN location IS NULL
                    THEN null

                    ELSE {{
                        id:
                            toString(location.id),

                        name:
                            coalesce(
                                location.name,
                                toString(location.id)
                            ),

                        exhibition_count:
                            exhibition_count
                    }}
                END
            )[0..{TOP_ARTIST_LOCATIONS}]

            WHERE item IS NOT NULL
        ] AS locations

        RETURN locations
    }}

    RETURN
        requested_id AS artist_id,
        exhibition_count,
        exhibited_item_count,
        locations
    """

    with get_driver().session() as session:
        records = session.run(
            query,
            artist_ids=artist_ids,
        )

        return {
            str(record["artist_id"]): {
                "exhibition_count": int(
                    record["exhibition_count"]
                    or 0
                ),
                "exhibited_item_count": int(
                    record["exhibited_item_count"]
                    or 0
                ),
                "locations": json_safe(
                    record["locations"]
                    or []
                ),
            }
            for record in records
        }


def _load_top_exhibitions(
        artist_ids: list[str],
        cluster_size: int,
) -> list[dict]:
    if not artist_ids:
        return []

    query = """
    UNWIND $artist_ids AS requested_id

    MATCH (artist:Artist)

    WHERE
        toString(artist.id)
        = requested_id

    MATCH
        (artist)
        -[:EXHIBITED_AT]->
        (exhibition:Exhibition)

    RETURN
        toString(exhibition.id)
            AS id,

        coalesce(
            exhibition.title,
            exhibition.name,
            toString(exhibition.id)
        ) AS name,

        count(
            DISTINCT artist
        ) AS artist_count

    ORDER BY
        artist_count DESC,
        name

    LIMIT $limit
    """

    with get_driver().session() as session:
        records = session.run(
            query,
            artist_ids=artist_ids,
            limit=TOP_EXPLANATION_ITEMS,
        )

        return [
            {
                "id": str(record["id"]),
                "name": str(record["name"]),
                "artist_count": int(
                    record["artist_count"]
                ),
                "percentage": (
                        int(record["artist_count"])
                        / cluster_size
                        * 100.0
                ),
            }
            for record in records
        ]


def _load_top_locations(
        artist_ids: list[str],
        cluster_size: int,
) -> list[dict]:
    if not artist_ids:
        return []

    query = """
    UNWIND $artist_ids AS requested_id

    MATCH (artist:Artist)

    WHERE
        toString(artist.id)
        = requested_id

    MATCH
        (artist)
        -[:EXHIBITED_AT]->
        (:Exhibition)
        -[:TOOK_PLACE_AT]->
        (location:Location)

    RETURN
        toString(location.id)
            AS id,

        coalesce(
            location.name,
            toString(location.id)
        ) AS name,

        count(
            DISTINCT artist
        ) AS artist_count

    ORDER BY
        artist_count DESC,
        name

    LIMIT $limit
    """

    with get_driver().session() as session:
        records = session.run(
            query,
            artist_ids=artist_ids,
            limit=TOP_EXPLANATION_ITEMS,
        )

        return [
            {
                "id": str(record["id"]),
                "name": str(record["name"]),
                "artist_count": int(
                    record["artist_count"]
                ),
                "percentage": (
                        int(record["artist_count"])
                        / cluster_size
                        * 100.0
                ),
            }
            for record in records
        ]


def _group_composition(
        group_memberships: dict[
            str,
            list[dict],
        ],
        cluster_size: int,
) -> tuple[
    list[dict],
    int,
    int,
]:
    counts: Counter[tuple[str, str]] = Counter()
    artists_with_group = 0

    for groups in group_memberships.values():
        if groups:
            artists_with_group += 1

        seen: set[str] = set()

        for group in groups:
            group_id = str(group["id"])

            if group_id in seen:
                continue

            seen.add(group_id)

            counts[
                (
                    group_id,
                    str(group["name"]),
                )
            ] += 1

    composition = [
        {
            "id": group_id,
            "name": group_name,
            "artist_count": int(count),
            "percentage": (
                    count
                    / cluster_size
                    * 100.0
            ),
        }
        for (
            group_id,
            group_name,
        ), count in counts.most_common()
    ]

    return (
        composition,
        artists_with_group,
        cluster_size - artists_with_group,
    )


def _cluster_similarity(
        embeddings: np.ndarray,
) -> np.ndarray:
    norms = np.linalg.norm(
        embeddings,
        axis=1,
        keepdims=True,
    )

    normalized = embeddings / np.clip(
        norms,
        1e-12,
        None,
    )

    centroid = normalized.mean(
        axis=0
    )

    centroid = centroid / max(
        float(np.linalg.norm(centroid)),
        1e-12,
    )

    return normalized @ centroid


@lru_cache(maxsize=64)
def _build_cluster_inspection(
        cluster_id: int,
        cluster_file_mtime: float,
        embedding_file_mtime: float,
) -> dict:
    del cluster_file_mtime
    del embedding_file_mtime

    metadata = pd.read_csv(
        ARTIST_CLUSTERS_PATH,
        dtype={
            "id": str,
            "entity": str,
        },
    )

    cluster = metadata.loc[
        metadata["cluster"].eq(cluster_id)
    ].copy()

    if cluster.empty:
        raise HTTPException(
            status_code=404,
            detail="Cluster not found",
        )

    cluster = cluster.sort_values(
        "artist_index"
    ).reset_index(drop=True)

    all_embeddings = np.load(
        ARTIST_EMBEDDINGS_PATH,
        mmap_mode="r",
    )

    artist_indices = cluster[
        "artist_index"
    ].astype(int).to_numpy()

    if (
            artist_indices.min() < 0
            or artist_indices.max()
            >= len(all_embeddings)
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Artist cluster metadata "
                "is not aligned with the "
                "Artist embeddings"
            ),
        )

    cluster_embeddings = np.asarray(
        all_embeddings[artist_indices],
        dtype=np.float32,
    )

    similarities = _cluster_similarity(
        cluster_embeddings
    )

    artist_ids = cluster[
        "id"
    ].astype(str).tolist()

    group_memberships = (
        _load_group_memberships(
            artist_ids
        )
    )

    activity_context = (
        _load_artist_activity_context(
            artist_ids
        )
    )

    cluster_size = len(cluster)

    (
        group_composition,
        artists_with_group,
        artists_without_group,
    ) = _group_composition(
        group_memberships,
        cluster_size,
    )

    top_exhibitions = _load_top_exhibitions(
        artist_ids,
        cluster_size,
    )

    top_locations = _load_top_locations(
        artist_ids,
        cluster_size,
    )

    artists: list[dict] = []

    for position, row in enumerate(
            cluster.itertuples(index=False)
    ):
        artist_id = str(row.id)

        entity = _clean_name(
            getattr(row, "entity", None),
            f"Artist:{artist_id}",
        )

        display_name = _clean_name(
            getattr(
                row,
                "display_name",
                None,
            ),
            entity,
        )

        artist_context = (
            activity_context.get(
                artist_id,
                {},
            )
        )

        artists.append({
            "id": artist_id,
            "entity": entity,
            "display_name": display_name,
            "birth_year": _optional_int(
                getattr(
                    row,
                    "birth_year",
                    None,
                )
            ),
            "death_year": _optional_int(
                getattr(
                    row,
                    "death_year",
                    None,
                )
            ),
            "gender": _clean_name(
                getattr(
                    row,
                    "gender",
                    None,
                ),
                "Unknown",
            ),
            "membership_probability": float(
                row.membership_probability
            ),
            "outlier_score": float(
                row.outlier_score
            ),
            "similarity_to_centroid": float(
                similarities[position]
            ),
            "groups": group_memberships.get(
                artist_id,
                [],
            ),
            "locations": artist_context.get(
                "locations",
                [],
            ),
            "exhibition_count": int(
                artist_context.get(
                    "exhibition_count",
                    0,
                )
            ),
            "exhibited_item_count": int(
                artist_context.get(
                    "exhibited_item_count",
                    0,
                )
            ),
        })

    artists.sort(
        key=lambda item: (
            -item[
                "similarity_to_centroid"
            ],
            -item[
                "membership_probability"
            ],
            item["display_name"].lower(),
        )
    )

    birth_years = pd.to_numeric(
        cluster.get("birth_year"),
        errors="coerce",
    ).dropna()

    death_years = pd.to_numeric(
        cluster.get("death_year"),
        errors="coerce",
    ).dropna()

    gender_counts = Counter(
        (artist.get("gender") or "Unknown").strip().upper()
        for artist in artists
    )

    exhibited_item_counts = np.asarray(
        [artist["exhibited_item_count"] for artist in artists],
        dtype=np.float64,
    )

    representative_artists = [
        {
            "id": artist["id"],
            "display_name": artist[
                "display_name"
            ],
            "similarity_to_centroid": artist[
                "similarity_to_centroid"
            ],
            "membership_probability": artist[
                "membership_probability"
            ],
        }
        for artist in artists[
            :REPRESENTATIVE_ARTISTS
        ]
    ]

    return {
        "cluster": cluster_id,
        "artist_count": cluster_size,
        "statistics": {
            "mean_membership_probability": float(
                cluster[
                    "membership_probability"
                ].mean()
            ),
            "mean_outlier_score": float(
                cluster[
                    "outlier_score"
                ].mean()
            ),
            "mean_similarity_to_centroid": float(
                similarities.mean()
            ),
            "birth_year": {
                "count": int(len(birth_years)),
                "minimum": (
                    None
                    if birth_years.empty
                    else int(birth_years.min())
                ),
                "median": (
                    None
                    if birth_years.empty
                    else float(
                        birth_years.median()
                    )
                ),
                "maximum": (
                    None
                    if birth_years.empty
                    else int(birth_years.max())
                ),
            },
            "death_year": {
                "count": int(len(death_years)),
                "minimum": (
                    None
                    if death_years.empty
                    else int(death_years.min())
                ),
                "median": (
                    None
                    if death_years.empty
                    else float(
                        death_years.median()
                    )
                ),
                "maximum": (
                    None
                    if death_years.empty
                    else int(death_years.max())
                ),
            },
            "artists_with_recorded_group": (
                artists_with_group
            ),
            "artists_without_recorded_group": (
                artists_without_group
            ),
            "gender_counts": {
                "female": int(gender_counts.get("F", 0)),
                "male": int(gender_counts.get("M", 0)),
                "unknown": int(
                    cluster_size
                    - gender_counts.get("F", 0)
                    - gender_counts.get("M", 0)
                ),
            },
            "exhibited_items": {
                "total": int(exhibited_item_counts.sum()),
                "median": float(np.median(exhibited_item_counts))
                if len(exhibited_item_counts)
                else 0.0,
                "mean": float(exhibited_item_counts.mean())
                if len(exhibited_item_counts)
                else 0.0,
                "maximum": int(exhibited_item_counts.max())
                if len(exhibited_item_counts)
                else 0,
            },
        },
        "birth_year_histogram": (
            _birth_year_histogram(
                cluster.get("birth_year")
            )
        ),
        "group_composition": group_composition,
        "explanation": {
            "top_artvis_groups": (
                group_composition[
                    :TOP_EXPLANATION_ITEMS
                ]
            ),
            "top_exhibitions": top_exhibitions,
            "top_locations": top_locations,
            "representative_artists": (
                representative_artists
            ),
            "note": (
                "These values are descriptive "
                "graph-based evidence for the "
                "cluster. They do not constitute "
                "a causal explanation of the "
                "embedding model."
            ),
        },
        "artists": artists,
    }


@router.get("")
def get_clusters():
    if (
            not HDBSCAN_SUMMARY_PATH.exists()
            or not CLUSTER_PROFILES_PATH.exists()
    ):
        raise HTTPException(
            status_code=404,
            detail="Cluster results not found",
        )

    response = {
        "summary": read_json(
            HDBSCAN_SUMMARY_PATH
        ),
        "profiles": read_json(
            CLUSTER_PROFILES_PATH
        ),
    }

    if HDBSCAN_CANDIDATES_PATH.exists():
        frame = pd.read_csv(
            HDBSCAN_CANDIDATES_PATH
        )

        response["candidates"] = (
            frame
            .astype(object)
            .where(
                pd.notna(frame),
                None,
            )
            .to_dict("records")
        )

    return response


def _normalized_gender(value: str | None) -> str:
    normalized = (value or "").strip().upper()

    if normalized == "F":
        return "F"

    if normalized == "M":
        return "M"

    return "UNKNOWN"


def _year_summary(values: list[int | None]) -> dict:
    clean = np.asarray(
        [value for value in values if value is not None],
        dtype=np.float64,
    )

    if len(clean) == 0:
        return {
            "count": 0,
            "minimum": None,
            "median": None,
            "maximum": None,
        }

    return {
        "count": int(len(clean)),
        "minimum": int(clean.min()),
        "median": float(np.median(clean)),
        "maximum": int(clean.max()),
    }


def _filtered_cluster_inspection(
        base: dict,
        genders: list[str] | None,
        minimum_membership: float,
        minimum_exhibited_items: int,
        birth_year_min: int | None,
        birth_year_max: int | None,
        group_ids: list[str] | None,
) -> dict:
    selected_genders = {
        _normalized_gender(value)
        for value in (genders or [])
    }
    selected_group_ids = {
        str(value)
        for value in (group_ids or [])
    }

    artists = []

    for artist in base["artists"]:
        if artist["membership_probability"] < minimum_membership:
            continue

        if artist["exhibited_item_count"] < minimum_exhibited_items:
            continue

        if selected_genders and (
                _normalized_gender(artist.get("gender"))
                not in selected_genders
        ):
            continue

        birth_year = artist.get("birth_year")

        if birth_year_min is not None and (
                birth_year is None
                or birth_year < birth_year_min
        ):
            continue

        if birth_year_max is not None and (
                birth_year is None
                or birth_year > birth_year_max
        ):
            continue

        if selected_group_ids:
            artist_group_ids = {
                str(group["id"])
                for group in artist.get("groups", [])
            }

            if not artist_group_ids.intersection(selected_group_ids):
                continue

        artists.append(artist)

    cluster_size = len(artists)
    artist_ids = [artist["id"] for artist in artists]
    group_memberships = {
        artist["id"]: artist.get("groups", [])
        for artist in artists
    }

    if cluster_size > 0:
        (
            group_composition,
            artists_with_group,
            artists_without_group,
        ) = _group_composition(
            group_memberships,
            cluster_size,
        )
        top_exhibitions = _load_top_exhibitions(artist_ids, cluster_size)
        top_locations = _load_top_locations(artist_ids, cluster_size)
    else:
        group_composition = []
        artists_with_group = 0
        artists_without_group = 0
        top_exhibitions = []
        top_locations = []

    gender_counts = Counter(
        _normalized_gender(artist.get("gender"))
        for artist in artists
    )
    exhibited_item_counts = np.asarray(
        [artist["exhibited_item_count"] for artist in artists],
        dtype=np.float64,
    )
    memberships = np.asarray(
        [artist["membership_probability"] for artist in artists],
        dtype=np.float64,
    )
    outlier_scores = np.asarray(
        [artist["outlier_score"] for artist in artists],
        dtype=np.float64,
    )
    center_similarities = np.asarray(
        [artist["similarity_to_centroid"] for artist in artists],
        dtype=np.float64,
    )

    representative_artists = [
        {
            "id": artist["id"],
            "display_name": artist["display_name"],
            "similarity_to_centroid": artist["similarity_to_centroid"],
            "membership_probability": artist["membership_probability"],
        }
        for artist in artists[:REPRESENTATIVE_ARTISTS]
    ]
    birth_year_values = [artist.get("birth_year") for artist in artists]
    death_year_values = [artist.get("death_year") for artist in artists]

    return {
        "cluster": base["cluster"],
        "artist_count": cluster_size,
        "statistics": {
            "mean_membership_probability": (
                float(memberships.mean()) if len(memberships) else 0.0
            ),
            "mean_outlier_score": (
                float(outlier_scores.mean()) if len(outlier_scores) else 0.0
            ),
            "mean_similarity_to_centroid": (
                float(center_similarities.mean())
                if len(center_similarities)
                else 0.0
            ),
            "birth_year": _year_summary(birth_year_values),
            "death_year": _year_summary(death_year_values),
            "artists_with_recorded_group": artists_with_group,
            "artists_without_recorded_group": artists_without_group,
            "gender_counts": {
                "female": int(gender_counts.get("F", 0)),
                "male": int(gender_counts.get("M", 0)),
                "unknown": int(gender_counts.get("UNKNOWN", 0)),
            },
            "exhibited_items": {
                "total": int(exhibited_item_counts.sum()),
                "median": (
                    float(np.median(exhibited_item_counts))
                    if len(exhibited_item_counts)
                    else 0.0
                ),
                "mean": (
                    float(exhibited_item_counts.mean())
                    if len(exhibited_item_counts)
                    else 0.0
                ),
                "maximum": (
                    int(exhibited_item_counts.max())
                    if len(exhibited_item_counts)
                    else 0
                ),
            },
        },
        "birth_year_histogram": _birth_year_histogram(
            pd.Series(birth_year_values, dtype="float64")
        ),
        "group_composition": group_composition,
        "explanation": {
            "top_artvis_groups": group_composition[:TOP_EXPLANATION_ITEMS],
            "top_exhibitions": top_exhibitions,
            "top_locations": top_locations,
            "representative_artists": representative_artists,
            "note": (
                "These values are descriptive graph-based evidence for "
                "the filtered cluster population. They do not constitute "
                "a causal explanation of the embedding model."
            ),
        },
        "artists": artists,
    }


@router.get(
    "/{cluster_id}/inspection"
)
def get_cluster_inspection(
        cluster_id: int,
        gender: list[str] | None = Query(default=None),
        minimum_membership: float = 0.0,
        minimum_exhibited_items: int = 0,
        birth_year_min: int | None = None,
        birth_year_max: int | None = None,
        group_id: list[str] | None = Query(default=None),
):
    if not ARTIST_CLUSTERS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Artist cluster file "
                "not found"
            ),
        )

    if not ARTIST_EMBEDDINGS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Artist embeddings "
                "not found"
            ),
        )

    base = _build_cluster_inspection(
        cluster_id,
        ARTIST_CLUSTERS_PATH
        .stat()
        .st_mtime,
        ARTIST_EMBEDDINGS_PATH
        .stat()
        .st_mtime,
    )

    has_filters = (
        bool(gender)
        or minimum_membership > 0
        or minimum_exhibited_items > 0
        or birth_year_min is not None
        or birth_year_max is not None
        or bool(group_id)
    )

    if not has_filters:
        return base

    return _filtered_cluster_inspection(
        base=base,
        genders=gender,
        minimum_membership=max(0.0, min(1.0, minimum_membership)),
        minimum_exhibited_items=max(0, minimum_exhibited_items),
        birth_year_min=birth_year_min,
        birth_year_max=birth_year_max,
        group_ids=group_id,
    )


@router.get("/{cluster_id}")
def get_cluster(
        cluster_id: int,
):
    if not CLUSTER_PROFILES_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Cluster profiles not found",
        )

    profiles = read_json(
        CLUSTER_PROFILES_PATH
    ).get("clusters", [])

    profile = next(
        (
            item
            for item in profiles
            if item.get("cluster")
               == cluster_id
        ),
        None,
    )

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Cluster not found",
        )

    return profile
