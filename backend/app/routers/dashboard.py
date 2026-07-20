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
)


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


_options_cache_lock = Lock()

_options_cache: tuple[
                    float,
                    dict,
                ] | None = None


def build_birth_year_histogram(
        frame: pd.DataFrame,
        bin_size: int = 10,
) -> list[dict]:
    years = pd.to_numeric(
        frame.get("birth_year"),
        errors="coerce",
    ).dropna()

    if years.empty:
        return []

    years = years.astype(int)

    minimum_year = int(
        years.min()
    )

    maximum_year = int(
        years.max()
    )

    start_year = (
            minimum_year
            // bin_size
            * bin_size
    )

    end_year = (
                       (
                               maximum_year
                               // bin_size
                       )
                       + 1
               ) * bin_size

    bins: list[dict] = []

    for lower_bound in range(
            start_year,
            end_year,
            bin_size,
    ):
        upper_bound = (
                lower_bound
                + bin_size
                - 1
        )

        count = int(
            (
                    (
                            years
                            >= lower_bound
                    )
                    & (
                            years
                            <= upper_bound
                    )
            ).sum()
        )

        bins.append({
            "start": lower_bound,
            "end": upper_bound,
            "count": count,
        })

    return bins


def load_graph_options() -> tuple[
    list[dict],
    list[dict],
    int,
    int,
]:
    group_options_query = """
    MATCH
        (artist:Artist)
        -[:MEMBER_OF]->
        (group:Group)

    WHERE
        artist.id IS NOT NULL
        AND group.id IS NOT NULL

    RETURN
        toString(group.id)
            AS id,

        coalesce(
            group.name,
            toString(group.id)
        ) AS name,

        count(DISTINCT artist)
            AS artist_count

    ORDER BY
        artist_count DESC,
        name
    """

    location_options_query = """
    MATCH
        (artist:Artist)
        -[:EXHIBITED_AT]->
        (:Exhibition)
        -[:TOOK_PLACE_AT]->
        (location:Location)

    WHERE
        artist.id IS NOT NULL
        AND location.id IS NOT NULL

    RETURN
        toString(location.id)
            AS id,

        coalesce(
            location.name,
            toString(location.id)
        ) AS name,

        count(DISTINCT artist)
            AS artist_count

    ORDER BY
        artist_count DESC,
        name
    """

    group_count_query = """
    MATCH (group:Group)

    RETURN
        count(group)
            AS count
    """

    location_count_query = """
    MATCH (location:Location)

    RETURN
        count(location)
            AS count
    """

    with (
            get_driver()
                    .session()
    ) as session:
        groups = [
            {
                "id": str(
                    record["id"]
                ),

                "name": str(
                    record["name"]
                ),

                "artist_count": int(
                    record[
                        "artist_count"
                    ]
                ),
            }

            for record
            in session.run(
                group_options_query
            )
        ]

        locations = [
            {
                "id": str(
                    record["id"]
                ),

                "name": str(
                    record["name"]
                ),

                "artist_count": int(
                    record[
                        "artist_count"
                    ]
                ),
            }

            for record
            in session.run(
                location_options_query
            )
        ]

        group_count_record = (
            session.run(
                group_count_query
            ).single()
        )

        location_count_record = (
            session.run(
                location_count_query
            ).single()
        )

    group_count = (
        int(
            group_count_record[
                "count"
            ]
        )
        if group_count_record
        else 0
    )

    location_count = (
        int(
            location_count_record[
                "count"
            ]
        )
        if location_count_record
        else 0
    )

    return (
        groups,
        locations,
        group_count,
        location_count,
    )


def load_dashboard_options() -> dict:
    global _options_cache

    if not ARTIST_MAP_2D_PATH.exists():
        raise HTTPException(
            status_code=404,

            detail=(
                "Missing dashboard "
                "artifact: "
                f"{ARTIST_MAP_2D_PATH.name}. "
                "Run the materialize "
                "pipeline step first."
            ),
        )

    modified_time = (
        ARTIST_MAP_2D_PATH
        .stat()
        .st_mtime
    )

    with _options_cache_lock:
        if (
                _options_cache is not None
                and _options_cache[0]
                == modified_time
        ):
            return _options_cache[1]

        frame = pd.read_parquet(
            ARTIST_MAP_2D_PATH
        )

        required_columns = {
            "cluster",
            "is_noise",
        }

        missing_columns = (
                required_columns
                - set(frame.columns)
        )

        if missing_columns:
            raise HTTPException(
                status_code=500,

                detail=(
                        "Dashboard map is "
                        "missing columns: "
                        + ", ".join(
                    sorted(
                        missing_columns
                    )
                )
                ),
            )

        (
            groups,
            locations,
            group_count,
            location_count,
        ) = load_graph_options()

        cluster_counts_frame = (
            frame
            .groupby(
                [
                    "cluster",
                    "is_noise",
                ],
                dropna=False,
            )
            .size()
            .rename("artist_count")
            .reset_index()
            .sort_values(
                [
                    "is_noise",
                    "cluster",
                ]
            )
        )

        clusters = [
            {
                "cluster": int(
                    row.cluster
                ),

                "is_noise": bool(
                    row.is_noise
                ),

                "artist_count": int(
                    row.artist_count
                ),
            }

            for row
            in cluster_counts_frame.itertuples(
                index=False
            )
        ]

        years = pd.to_numeric(
            frame.get("birth_year"),
            errors="coerce",
        ).dropna()

        noise_mask = (
            frame["is_noise"]
            .fillna(False)
            .astype(bool)
        )

        noise_count = int(
            noise_mask.sum()
        )

        cluster_count = int(
            frame.loc[
                ~noise_mask,
                "cluster",
            ].nunique()
        )

        artist_count = int(
            len(frame)
        )

        result = {
            "overview": {
                "artist_count": (
                    artist_count
                ),

                "cluster_count": (
                    cluster_count
                ),

                "group_count": (
                    group_count
                ),

                "location_count": (
                    location_count
                ),

                "noise_count": (
                    noise_count
                ),

                "noise_fraction": (
                    noise_count
                    / artist_count

                    if artist_count
                    else 0.0
                ),

                "birth_year_min": (
                    None
                    if years.empty
                    else int(
                        years.min()
                    )
                ),

                "birth_year_max": (
                    None
                    if years.empty
                    else int(
                        years.max()
                    )
                ),
            },

            "clusters": clusters,
            "groups": groups,
            "locations": locations,

            "birth_year_histogram":
                build_birth_year_histogram(
                    frame
                ),
        }

        _options_cache = (
            modified_time,
            result,
        )

        return result


@router.get("/options")
def get_dashboard_options():
    return load_dashboard_options()


@router.get("/filter-artists")
def get_filtered_artist_ids(
        group: list[str] | None = Query(
            default=None
        ),

        location: list[str] | None = Query(
            default=None
        ),
):
    selected_groups = (
            group or []
    )

    selected_locations = (
            location or []
    )

    query = """
    MATCH (artist:Artist)

    WHERE
        artist.id IS NOT NULL

        AND (
            size($group_ids) = 0

            OR EXISTS {
                MATCH
                    (artist)
                    -[:MEMBER_OF]->
                    (selected_group:Group)

                WHERE
                    toString(
                        selected_group.id
                    ) IN $group_ids
            }
        )

        AND (
            size($location_ids) = 0

            OR EXISTS {
                MATCH
                    (artist)
                    -[:EXHIBITED_AT]->
                    (:Exhibition)
                    -[:TOOK_PLACE_AT]->
                    (
                        selected_location:
                        Location
                    )

                WHERE
                    toString(
                        selected_location.id
                    ) IN $location_ids
            }
        )

    RETURN DISTINCT
        toString(artist.id)
            AS id

    ORDER BY id
    """

    with (
            get_driver()
                    .session()
    ) as session:
        artist_ids = [
            str(
                record["id"]
            )

            for record
            in session.run(
                query,

                group_ids=(
                    selected_groups
                ),

                location_ids=(
                    selected_locations
                ),
            )
        ]

    return {
        "artist_ids": artist_ids,
        "artist_count": len(
            artist_ids
        ),
    }