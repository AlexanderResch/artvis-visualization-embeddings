from contextlib import (
    asynccontextmanager
)

from fastapi import FastAPI

from fastapi.middleware.cors import (
    CORSMiddleware
)

from app.db import (
    close_driver,
    get_driver,
)

from app.routers.artists import (
    router as artists_router
)

from app.routers.clusters import (
    router as clusters_router
)

from app.routers.embeddings import (
    router as embeddings_router
)

from app.routers.evaluation import (
    router as evaluation_router
)


@asynccontextmanager
async def lifespan(
        _: FastAPI
):
    yield

    close_driver()


app = FastAPI(
    title="ArtVis Backend",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    embeddings_router
)

app.include_router(
    artists_router
)

app.include_router(
    clusters_router
)

app.include_router(
    evaluation_router
)


@app.get("/health")
def health():
    return {
        "status": "ok"
    }


@app.get("/graph/stats")
def graph_stats():
    with (
            get_driver()
                    .session()
    ) as session:
        node_result = (
            session.run(
                """
                MATCH (node)

                RETURN
                    labels(node)
                        AS labels,

                    count(node)
                        AS count

                ORDER BY
                    count DESC
                """
            )
        )

        relationship_result = (
            session.run(
                """
                MATCH
                    ()-[relationship]->()

                RETURN
                    type(relationship)
                        AS type,

                    count(relationship)
                        AS count

                ORDER BY
                    count DESC
                """
            )
        )

        nodes = [
            {
                "labels": (
                    record["labels"]
                ),

                "count": (
                    record["count"]
                ),
            }

            for record
            in node_result
        ]

        relationships = [
            {
                "type": (
                    record["type"]
                ),

                "count": (
                    record["count"]
                ),
            }

            for record
            in relationship_result
        ]

    return {
        "nodes": nodes,
        "relationships": relationships,
    }