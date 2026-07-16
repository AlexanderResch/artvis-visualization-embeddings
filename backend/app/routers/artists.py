from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from app.db import (
    get_driver
)

from app.ml.utils import (
    json_safe
)


router = APIRouter(
    prefix="/artists",
    tags=["Artists"],
)


@router.get("/{artist_id}")
def get_artist(
        artist_id: str
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