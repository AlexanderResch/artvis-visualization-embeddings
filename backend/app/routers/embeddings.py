from functools import lru_cache
from pathlib import Path
from threading import Lock

import pandas as pd

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from app.db import get_driver
from app.ml.config import (
    ARTIST_MAP_2D_PATH,
    ARTIST_MAP_3D_PATH,
)


router = APIRouter(
    prefix="/embeddings",
    tags=["Artist embedding maps"],
)


_cache_lock = Lock()
_cache: dict[str, tuple[float, pd.DataFrame]] = {}


def load_frame(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Missing result file: {path.name}",
        )

    modified_time = path.stat().st_mtime
    cache_key = str(path)

    with _cache_lock:
        cached = _cache.get(cache_key)

        if cached is None or cached[0] != modified_time:
            frame = pd.read_parquet(path)
            _cache[cache_key] = (modified_time, frame)

        return _cache[cache_key][1].copy()


@lru_cache(maxsize=1)
def load_exhibited_item_counts() -> dict[str, int]:
    """
    Count recorded exhibited items for every Artist.

    Count the recorded EXHIBITED_AT relationships used by the application
    as its exhibited-artwork measure. This preserves repeated recorded
    entries between the same Artist and Exhibition, while
    count(DISTINCT exhibition) would only count exhibition events.
    """
    query = """
    MATCH (artist:Artist)
    WHERE artist.id IS NOT NULL

    OPTIONAL MATCH
        (artist)-[record:EXHIBITED_AT]->(:Exhibition)

    RETURN
        toString(artist.id) AS artist_id,
        count(record) AS exhibited_item_count
    """

    with get_driver().session() as session:
        return {
            str(record["artist_id"]): int(
                record["exhibited_item_count"] or 0
            )
            for record in session.run(query)
        }


def enrich_activity_counts(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    counts = load_exhibited_item_counts()

    result["exhibited_item_count"] = (
        result["id"]
        .astype(str)
        .map(counts)
        .fillna(0)
        .astype(int)
    )

    return result


def to_records(frame: pd.DataFrame) -> list[dict]:
    clean = (
        frame
        .astype(object)
        .where(pd.notna(frame), None)
    )

    return clean.to_dict(orient="records")


def filter_frame(
        frame: pd.DataFrame,
        clusters: list[int] | None,
        cluster_status: str,
        minimum_membership: float | None,
        birth_year_from: int | None,
        birth_year_to: int | None,
        gender: list[str] | None,
        minimum_exhibited_items: int | None,
        search: str | None,
        limit: int | None,
) -> pd.DataFrame:
    result = frame

    if cluster_status == "clustered":
        result = result.loc[~result["is_noise"]]
    elif cluster_status == "noise":
        result = result.loc[result["is_noise"]]

    if clusters:
        result = result.loc[
            result["cluster"].isin(clusters)
        ]

    if minimum_membership is not None:
        # Noise points have no meaningful cluster-assignment strength.
        result = result.loc[
            result["is_noise"]
            | (
                result["membership_probability"]
                >= minimum_membership
            )
        ]

    years = pd.to_numeric(
        result.get("birth_year"),
        errors="coerce",
    )

    if birth_year_from is not None:
        result = result.loc[years >= birth_year_from]
        years = years.loc[result.index]

    if birth_year_to is not None:
        result = result.loc[years <= birth_year_to]

    if gender:
        normalized_gender = (
            result.get("gender")
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )

        selected = {value.strip().upper() for value in gender}
        include_unknown = "UNKNOWN" in selected
        selected_codes = selected - {"UNKNOWN"}

        mask = normalized_gender.isin(selected_codes)

        if include_unknown:
            mask = mask | ~normalized_gender.isin({"M", "F"})

        result = result.loc[mask]

    if minimum_exhibited_items is not None:
        result = result.loc[
            result["exhibited_item_count"]
            >= minimum_exhibited_items
        ]

    if search:
        result = result.loc[
            result["display_name"]
            .fillna("")
            .str.contains(
                search,
                case=False,
                regex=False,
            )
        ]

    if limit is not None:
        result = result.head(limit)

    return result


def create_response(
        path: Path,
        cluster: list[int] | None,
        cluster_status: str,
        minimum_membership: float | None,
        birth_year_from: int | None,
        birth_year_to: int | None,
        gender: list[str] | None,
        minimum_exhibited_items: int | None,
        search: str | None,
        limit: int | None,
) -> list[dict]:
    frame = enrich_activity_counts(load_frame(path))

    filtered = filter_frame(
        frame,
        cluster,
        cluster_status,
        minimum_membership,
        birth_year_from,
        birth_year_to,
        gender,
        minimum_exhibited_items,
        search,
        limit,
    )

    return to_records(filtered)


def _embedding_endpoint(path: Path):
    def endpoint(
            cluster: list[int] | None = Query(default=None),
            cluster_status: str = Query(
                default="all",
                pattern="^(all|clustered|noise)$",
            ),
            minimum_membership: float | None = Query(
                default=None,
                ge=0.0,
                le=1.0,
            ),
            birth_year_from: int | None = Query(default=None),
            birth_year_to: int | None = Query(default=None),
            gender: list[str] | None = Query(default=None),
            minimum_exhibited_items: int | None = Query(
                default=None,
                ge=0,
            ),
            search: str | None = Query(
                default=None,
                min_length=1,
            ),
            limit: int | None = Query(
                default=None,
                ge=1,
                le=50000,
            ),
    ):
        return create_response(
            path,
            cluster,
            cluster_status,
            minimum_membership,
            birth_year_from,
            birth_year_to,
            gender,
            minimum_exhibited_items,
            search,
            limit,
        )

    return endpoint


get_embeddings_2d = _embedding_endpoint(ARTIST_MAP_2D_PATH)
get_embeddings_2d.__name__ = "get_embeddings_2d"
router.get("/2d")(get_embeddings_2d)

get_embeddings_3d = _embedding_endpoint(ARTIST_MAP_3D_PATH)
get_embeddings_3d.__name__ = "get_embeddings_3d"
router.get("/3d")(get_embeddings_3d)
