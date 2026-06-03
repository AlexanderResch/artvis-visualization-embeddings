from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import get_driver, close_driver
from app.routers.embeddings import router as embeddings_router

app = FastAPI(title="ArtVis Backend")

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

app.include_router(embeddings_router)


@app.on_event("shutdown")
def shutdown_event():
    close_driver()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/graph/stats")
def graph_stats():
    driver = get_driver()

    with driver.session() as session:
        node_result = session.run("""
            MATCH (n)
            RETURN labels(n) AS labels, count(n) AS count
            ORDER BY count DESC
        """)

        rel_result = session.run("""
            MATCH ()-[r]->()
            RETURN type(r) AS type, count(r) AS count
            ORDER BY count DESC
        """)

        nodes = [
            {
                "labels": record["labels"],
                "count": record["count"]
            }
            for record in node_result
        ]

        relationships = [
            {
                "type": record["type"],
                "count": record["count"]
            }
            for record in rel_result
        ]

    return {
        "nodes": nodes,
        "relationships": relationships
    }