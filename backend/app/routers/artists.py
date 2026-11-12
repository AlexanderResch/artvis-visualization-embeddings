from app.model_artifacts import artifact_path
from app.ml.utils import read_table
from threading import Lock

import numpy as np
import pandas as pd

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from app.db import get_driver
from app.schemas.artist import ArtistContextResponse
from app.services.artist_context import fetch_artist_context


from app.ml.utils import (
    json_safe,
)


router = APIRouter(
    prefix="/artists",
    tags=["Artists"],
)


_embedding_cache_lock = Lock()

_embedding_cache = {}


def parse_boolean(
        value,
) -> bool:
    if isinstance(
            value,
            str,
    ):
        return (
                value.strip().lower()
                == "true"
        )

    return bool(value)


def optional_integer(
        value,
) -> int | None:
    if pd.isna(value):
        return None

    return int(value)


def load_embedding_index() -> tuple[pd.DataFrame, np.ndarray, dict[str, int]]:
    embedding_path = artifact_path("artist_embeddings.npy")
    metadata_path = artifact_path("artist_clusters.parquet")
    if not embedding_path.exists() or not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Artist embedding data are missing.")
    key = str(embedding_path)
    times = (embedding_path.stat().st_mtime_ns, metadata_path.stat().st_mtime_ns)
    with _embedding_cache_lock:
        cached = _embedding_cache.get(key)
        if cached is None or cached[:2] != times:
            metadata = read_table(metadata_path, dtype={"id": str, "entity": str})
            metadata = metadata.sort_values("artist_index").reset_index(drop=True)
            embeddings = np.load(embedding_path).astype(np.float32)
            if embeddings.ndim != 2 or len(metadata) != len(embeddings):
                raise HTTPException(status_code=500, detail="Artist embeddings and metadata are not aligned.")
            if not np.array_equal(metadata.artist_index, np.arange(len(metadata))):
                raise HTTPException(status_code=500, detail="Artist embedding indices are not aligned.")
            normalized = embeddings / np.maximum(np.linalg.norm(embeddings, axis=1, keepdims=True), 1e-12)
            positions = {str(value): index for index, value in enumerate(metadata.id)}
            cached = (*times, metadata, normalized, positions)
            _embedding_cache[key] = cached
        return cached[2], cached[3], cached[4]


def load_shared_context(
        source_id: str,
        candidate_ids: list[str],
) -> dict[str, dict]:
    if not candidate_ids:
        return {}

    query = """
    MATCH (source:Artist)

    WHERE
        toString(source.id)
        = $source_id

    UNWIND
        $candidate_ids
        AS candidate_id

    MATCH (candidate:Artist)

    WHERE
        toString(candidate.id)
        = candidate_id

    CALL {
        WITH
            source,
            candidate

        OPTIONAL MATCH
            (source)
            -[:MEMBER_OF]->
            (group:Group)
            <-[:MEMBER_OF]-
            (candidate)

        RETURN [
            value IN collect(
                DISTINCT CASE

                    WHEN group IS NULL
                    THEN null

                    ELSE {
                        id:
                            toString(
                                group.id
                            ),

                        name:
                            coalesce(
                                group.name,
                                toString(
                                    group.id
                                )
                            )
                    }
                END
            )

            WHERE value IS NOT NULL
        ][0..5] AS common_groups
    }

    CALL {
        WITH
            source,
            candidate

        OPTIONAL MATCH
            (source)
            -[:EXHIBITED_AT]->
            (exhibition:Exhibition)
            <-[:EXHIBITED_AT]-
            (candidate)

        RETURN [
            value IN collect(
                DISTINCT CASE

                    WHEN exhibition
                    IS NULL

                    THEN null

                    ELSE {
                        id:
                            toString(
                                exhibition.id
                            ),

                        name:
                            coalesce(
                                exhibition.title,
                                toString(
                                    exhibition.id
                                )
                            )
                    }
                END
            )

            WHERE value IS NOT NULL
        ][0..5] AS common_exhibitions
    }

    CALL {
        WITH
            source,
            candidate

        OPTIONAL MATCH
            (source)
            -[:EXHIBITED_AT]->
            (:Exhibition)
            -[:TOOK_PLACE_AT]->
            (location:Location)
            <-[:TOOK_PLACE_AT]-
            (:Exhibition)
            <-[:EXHIBITED_AT]-
            (candidate)

        RETURN [
            value IN collect(
                DISTINCT CASE

                    WHEN location IS NULL
                    THEN null

                    ELSE {
                        id:
                            toString(
                                location.id
                            ),

                        name:
                            coalesce(
                                location.name,
                                toString(
                                    location.id
                                )
                            )
                    }
                END
            )

            WHERE value IS NOT NULL
        ][0..5] AS common_locations
    }

    RETURN
        candidate_id,
        common_groups,
        common_exhibitions,
        common_locations
    """

    with (
            get_driver()
                    .session()
    ) as session:
        records = session.run(
            query,

            source_id=source_id,

            candidate_ids=(
                candidate_ids
            ),
        )

        return {
            str(
                record[
                    "candidate_id"
                ]
            ): {
                "common_groups":
                    json_safe(
                        record[
                            "common_groups"
                        ]
                        or []
                    ),

                "common_exhibitions":
                    json_safe(
                        record[
                            "common_exhibitions"
                        ]
                        or []
                    ),

                "common_locations":
                    json_safe(
                        record[
                            "common_locations"
                        ]
                        or []
                    ),
            }

            for record in records
        }


@router.get(
    "/{artist_id}/similar"
)
def get_similar_artists(
        artist_id: str,

        limit: int = Query(
            default=10,
            ge=1,
            le=50,
        ),
):
    (
        metadata,
        normalized_embeddings,
        id_to_position,
    ) = load_embedding_index()

    source_position = (
        id_to_position.get(
            str(artist_id)
        )
    )

    if source_position is None:
        raise HTTPException(
            status_code=404,

            detail=(
                "Artist embedding "
                "not found"
            ),
        )

    similarities = (
            normalized_embeddings
            @ normalized_embeddings[
                source_position
            ]
    )

    similarities[
        source_position
    ] = -np.inf

    candidate_count = min(
        limit,
        len(similarities) - 1,
        )

    if candidate_count <= 0:
        return []

    candidate_positions = (
        np.argpartition(
            -similarities,
            candidate_count - 1,
            )[:candidate_count]
    )

    candidate_positions = (
        candidate_positions[
            np.argsort(
                -similarities[
                    candidate_positions
                ]
            )
        ]
    )

    candidates = (
        metadata
        .iloc[
            candidate_positions
        ]
        .copy()
    )

    candidate_ids = (
        candidates["id"]
        .astype(str)
        .tolist()
    )

    shared_context = (
        load_shared_context(
            str(artist_id),
            candidate_ids,
        )
    )

    response: list[dict] = []

    for (
            position,
            (_, row),
    ) in zip(
        candidate_positions,
        candidates.iterrows(),
        strict=True,
    ):
        candidate_id = str(
            row["id"]
        )

        context = (
            shared_context.get(
                candidate_id,
                {},
            )
        )

        response.append({
            "id": candidate_id,

            "entity": str(
                row["entity"]
            ),

            "display_name": str(
                row.get(
                    "display_name",
                    row["entity"],
                )
            ),

            "similarity": float(
                similarities[
                    position
                ]
            ),

            "cluster": int(
                row["cluster"]
            ),

            "is_noise": (
                parse_boolean(
                    row["is_noise"]
                )
            ),

            "membership_probability":
                float(
                    row[
                        "membership_probability"
                    ]
                ),

            "outlier_score": float(
                row[
                    "outlier_score"
                ]
            ),

            "birth_year": (
                optional_integer(
                    row.get(
                        "birth_year"
                    )
                )
            ),

            "death_year": (
                optional_integer(
                    row.get(
                        "death_year"
                    )
                )
            ),
            "nationality": (
                str(row["nationality"])
                if pd.notna(row.get("nationality"))
                else None
            ),

            "common_groups":
                context.get(
                    "common_groups",
                    [],
                ),

            "common_exhibitions":
                context.get(
                    "common_exhibitions",
                    [],
                ),

            "common_locations":
                context.get(
                    "common_locations",
                    [],
                ),
        })

    return response


@router.get("/{artist_id}")
def get_artist(
        artist_id: str,
):
    query = """
    MATCH (artist:Artist)

    WHERE
        toString(artist.id)
        = $artist_id

    RETURN
        toString(artist.id)
            AS id,

        properties(artist)
            AS properties
    """

    with (
            get_driver()
                    .session()
    ) as session:
        record = session.run(
            query,
            artist_id=artist_id,
        ).single()

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Artist not found",
        )

    properties = dict(
        record["properties"]
        or {}
    )

    return {
        "id": record["id"],

        "entity": (
            f"Artist:"
            f"{record['id']}"
        ),

        "display_name": (
                properties.get(
                    "sortname"
                )
                or
                f"Artist:"
                f"{record['id']}"
        ),

        "properties": json_safe(
            properties
        ),
    }


@router.get(
    "/{artist_id}/ego"
)
def get_artist_ego(
        artist_id: str,

        limit: int = Query(
            default=200,
            ge=1,
            le=2000,
        ),
):
    query = """
    MATCH (artist:Artist)

    WHERE
        toString(artist.id)
        = $artist_id

    MATCH
        (artist)
        -[relationship]-
        (neighbor)

    RETURN
        labels(artist)[0]
            AS source_type,

        toString(artist.id)
            AS source_id,

        properties(artist)
            AS source_properties,

        type(relationship)
            AS relation,

        labels(neighbor)[0]
            AS target_type,

        toString(neighbor.id)
            AS target_id,

        properties(neighbor)
            AS target_properties

    LIMIT $limit
    """

    with (
            get_driver()
                    .session()
    ) as session:
        rows = list(
            session.run(
                query,
                artist_id=artist_id,
                limit=limit,
            )
        )

    if not rows:
        raise HTTPException(
            status_code=404,

            detail=(
                "Artist or "
                "neighborhood "
                "not found"
            ),
        )

    return [
        {
            "source_type": (
                row["source_type"]
            ),

            "source_id": (
                row["source_id"]
            ),

            "source_properties":
                json_safe(
                    dict(
                        row[
                            "source_properties"
                        ]
                        or {}
                    )
                ),

            "relation": (
                row["relation"]
            ),

            "target_type": (
                row["target_type"]
            ),

            "target_id": (
                row["target_id"]
            ),

            "target_properties":
                json_safe(
                    dict(
                        row[
                            "target_properties"
                        ]
                        or {}
                    )
                ),
        }

        for row in rows
    ]

@router.get(
    "/{artist_id}/context",
    response_model=ArtistContextResponse,
)
def get_artist_context(
        artist_id: str,
) -> ArtistContextResponse:
    with get_driver().session() as session:
        context = fetch_artist_context(
            session,
            artist_id.strip(),
        )

    return ArtistContextResponse.model_validate(
        context
    )
