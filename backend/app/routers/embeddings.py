from pathlib import Path
from threading import Lock

import pandas as pd

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from app.ml.config import (
    ARTIST_MAP_2D_PATH,
    ARTIST_MAP_3D_PATH,
)


router = APIRouter(
    prefix="/embeddings",

    tags=[
        "Artist embedding maps"
    ],
)


_cache_lock = Lock()

_cache: dict[
    str,
    tuple[
        float,
        pd.DataFrame,
    ],
] = {}


def load_frame(
        path: Path
) -> pd.DataFrame:
    if not path.exists():
        raise HTTPException(
            status_code=404,

            detail=(
                "Missing result file: "
                f"{path.name}"
            ),
        )

    modified_time = (
        path.stat().st_mtime
    )

    cache_key = str(path)

    with _cache_lock:
        cached = _cache.get(
            cache_key
        )

        if (
                cached is None
                or cached[0]
                != modified_time
        ):
            frame = pd.read_parquet(
                path
            )

            _cache[
                cache_key
            ] = (
                modified_time,
                frame,
            )

        return _cache[
            cache_key
        ][1].copy()


def to_records(
        frame: pd.DataFrame
) -> list[dict]:
    clean = (
        frame
        .astype(object)
        .where(
            pd.notna(frame),
            None,
        )
    )

    return clean.to_dict(
        orient="records"
    )


def filter_frame(
        frame: pd.DataFrame,
        clusters: list[int] | None,
        include_noise: bool,
        minimum_membership:
        float | None,
        birth_year_from:
        int | None,
        birth_year_to:
        int | None,
        search: str | None,
        limit: int | None,
) -> pd.DataFrame:
    result = frame

    if clusters:
        result = result.loc[
            result["cluster"].isin(
                clusters
            )
        ]

    elif not include_noise:
        result = result.loc[
            ~result["is_noise"]
        ]

    if (
            minimum_membership
            is not None
    ):
        result = result.loc[
            result[
                "membership_probability"
            ]
            >= minimum_membership
            ]

    years = pd.to_numeric(
        result.get(
            "birth_year"
        ),

        errors="coerce",
    )

    if birth_year_from is not None:
        result = result.loc[
            years
            >= birth_year_from
            ]

        years = years.loc[
            result.index
        ]

    if birth_year_to is not None:
        result = result.loc[
            years
            <= birth_year_to
            ]

    if search:
        result = result.loc[
            result[
                "display_name"
            ]
            .fillna("")
            .str.contains(
                search,
                case=False,
                regex=False,
            )
        ]

    if limit is not None:
        result = result.head(
            limit
        )

    return result


def create_response(
        path: Path,
        cluster: list[int] | None,
        include_noise: bool,
        minimum_membership:
        float | None,
        birth_year_from:
        int | None,
        birth_year_to:
        int | None,
        search: str | None,
        limit: int | None,
) -> list[dict]:
    frame = load_frame(path)

    filtered = filter_frame(
        frame,
        cluster,
        include_noise,
        minimum_membership,
        birth_year_from,
        birth_year_to,
        search,
        limit,
    )

    return to_records(
        filtered
    )


@router.get("/2d")
def get_embeddings_2d(
        cluster: list[int] | None = (
                Query(default=None)
        ),

        include_noise: bool = (
                Query(default=True)
        ),

        minimum_membership:
        float | None = Query(
            default=None,
            ge=0.0,
            le=1.0,
        ),

        birth_year_from:
        int | None = Query(
            default=None
        ),

        birth_year_to:
        int | None = Query(
            default=None
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
        ARTIST_MAP_2D_PATH,
        cluster,
        include_noise,
        minimum_membership,
        birth_year_from,
        birth_year_to,
        search,
        limit,
    )


@router.get("/3d")
def get_embeddings_3d(
        cluster: list[int] | None = (
                Query(default=None)
        ),

        include_noise: bool = (
                Query(default=True)
        ),

        minimum_membership:
        float | None = Query(
            default=None,
            ge=0.0,
            le=1.0,
        ),

        birth_year_from:
        int | None = Query(
            default=None
        ),

        birth_year_to:
        int | None = Query(
            default=None
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
        ARTIST_MAP_3D_PATH,
        cluster,
        include_noise,
        minimum_membership,
        birth_year_from,
        birth_year_to,
        search,
        limit,
    )