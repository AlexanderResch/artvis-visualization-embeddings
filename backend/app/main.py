from contextlib import (
    asynccontextmanager
)

from fastapi import FastAPI, HTTPException, Request

from fastapi.middleware.cors import (
    CORSMiddleware
)
from fastapi.responses import JSONResponse
from neo4j.exceptions import (
    Neo4jError,
    ServiceUnavailable,
    SessionExpired,
    TransientError,
)

from app.routers.artist_inspection import (
    router as artist_inspection_router
)

from app.db import (
    close_driver,
    get_driver,
    verify_connectivity,
)

from app.model_artifacts import CURRENT_MODEL, current_artifacts, available_models, resolve_model

from app.routers.artists import (
    router as artists_router
)

from app.routers.artist_comparison import (
    router as artist_comparison_router,
)

from app.routers.clusters import (
    router as clusters_router
)

from app.routers.dashboard import (
    router as dashboard_router
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


@app.middleware("http")
async def embedding_model_context(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in {"/health", "/models", "/docs", "/openapi.json", "/redoc"}:
        return await call_next(request)
    try:
        selected = resolve_model(request.query_params.get("model") or request.headers.get("X-Embedding-Model"))
    except HTTPException as error:
        return JSONResponse(status_code=error.status_code, content={"detail": error.detail})
    token = CURRENT_MODEL.set(selected)
    try:
        response = await call_next(request)
        response.headers["X-Embedding-Model"] = selected.key
        return response
    finally:
        CURRENT_MODEL.reset(token)


@app.get("/models")
def get_models():
    return available_models()


@app.exception_handler(ServiceUnavailable)
@app.exception_handler(SessionExpired)
@app.exception_handler(TransientError)
async def handle_neo4j_unavailable(
        _: Request,
        error: Exception,
):
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "The ArtVis graph database is temporarily unavailable. "
                "Please wait a moment and try again."
            ),
            "error_type": error.__class__.__name__,
        },
    )


@app.exception_handler(Neo4jError)
async def handle_neo4j_error(
        _: Request,
        error: Neo4jError,
):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "The graph query could not be completed.",
            "error_type": error.__class__.__name__,
        },
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
    expose_headers=["X-Embedding-Model"],
)


app.include_router(
    embeddings_router
)

app.include_router(
    artist_comparison_router,
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

app.include_router(
    dashboard_router
)

app.include_router(
    artist_inspection_router
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "artvis-backend",
    }


@app.get("/ready")
def ready():
    missing_artifacts = current_artifacts().missing_files()

    if missing_artifacts:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Required ML artifacts are missing.",
                "missing_artifacts": missing_artifacts,
            },
        )

    verify_connectivity()

    return {
        "status": "ready",
        "database": "available",
        "ml_artifacts": "available",
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

                "count": int(
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

                "count": int(
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
