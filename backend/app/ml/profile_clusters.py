import json

import duckdb
import numpy as np
import pandas as pd

from app.ml.config import (
    ARTIST_CLUSTERS_PATH,
    CLUSTER_PROFILES_PATH,
    ENTITY_METADATA_PATH,
    INDEXED_EDGES_PATH,
)
from app.ml.utils import write_json

TOP_RELATED_PER_GROUP = 10
REPRESENTATIVE_ARTISTS = 10


def _sql_path(path) -> str:
    return str(path.resolve()).replace("'", "''")


def run() -> None:
    artists = pd.read_csv(ARTIST_CLUSTERS_PATH, dtype={"entity": str, "id": str})
    clustered = artists.loc[artists["cluster"] >= 0].copy()
    if clustered.empty:
        write_json(CLUSTER_PROFILES_PATH, {"clusters": []})
        return

    connection = duckdb.connect()
    connection.register("artist_clusters", clustered[[
        "global_index",
        "cluster",
        "entity",
        "display_name",
        "birth_year",
        "death_year",
        "membership_probability",
        "outlier_score",
    ]])

    metadata_path = _sql_path(ENTITY_METADATA_PATH)
    edges_path = _sql_path(INDEXED_EDGES_PATH)
    query = f"""
        WITH related AS (
            SELECT
                cluster.cluster,
                edge.relation,
                neighbor.type AS neighbor_type,
                neighbor.entity AS neighbor_entity,
                neighbor.display_name AS neighbor_name
            FROM artist_clusters AS cluster
            INNER JOIN read_parquet('{edges_path}') AS edge
                ON edge.head = cluster.global_index
            INNER JOIN read_parquet('{metadata_path}') AS neighbor
                ON neighbor.global_index = edge.tail

            UNION ALL

            SELECT
                cluster.cluster,
                edge.relation,
                neighbor.type AS neighbor_type,
                neighbor.entity AS neighbor_entity,
                neighbor.display_name AS neighbor_name
            FROM artist_clusters AS cluster
            INNER JOIN read_parquet('{edges_path}') AS edge
                ON edge.tail = cluster.global_index
            INNER JOIN read_parquet('{metadata_path}') AS neighbor
                ON neighbor.global_index = edge.head
        ),
        counted AS (
            SELECT
                cluster,
                relation,
                neighbor_type,
                neighbor_entity,
                neighbor_name,
                COUNT(*) AS occurrence_count
            FROM related
            WHERE neighbor_type <> 'Artist'
            GROUP BY cluster, relation, neighbor_type, neighbor_entity, neighbor_name
        ),
        ranked AS (
            SELECT *, ROW_NUMBER() OVER (
                PARTITION BY cluster, relation, neighbor_type
                ORDER BY occurrence_count DESC, neighbor_name
            ) AS rank
            FROM counted
        )
        SELECT * FROM ranked WHERE rank <= {TOP_RELATED_PER_GROUP}
        ORDER BY cluster, relation, neighbor_type, rank
    """
    related = connection.execute(query).fetch_df()
    connection.close()

    profiles: list[dict] = []
    for cluster_id, group in clustered.groupby("cluster"):
        representatives = group.sort_values(
            ["membership_probability", "outlier_score", "display_name"],
            ascending=[False, True, True],
        ).head(REPRESENTATIVE_ARTISTS)
        birth_years = pd.to_numeric(group["birth_year"], errors="coerce").dropna()
        death_years = pd.to_numeric(group["death_year"], errors="coerce").dropna()

        cluster_related = related.loc[related["cluster"] == cluster_id] if not related.empty else related
        top_related: dict[str, list[dict]] = {}
        for (relation, neighbor_type), related_group in cluster_related.groupby(["relation", "neighbor_type"]):
            key = f"{relation}:{neighbor_type}"
            top_related[key] = [
                {
                    "entity": row.neighbor_entity,
                    "display_name": row.neighbor_name,
                    "count": int(row.occurrence_count),
                }
                for row in related_group.itertuples()
            ]

        profiles.append({
            "cluster": int(cluster_id),
            "artist_count": int(len(group)),
            "mean_membership_probability": float(group["membership_probability"].mean()),
            "mean_outlier_score": float(group["outlier_score"].mean()),
            "birth_year": {
                "count": int(len(birth_years)),
                "minimum": None if birth_years.empty else int(birth_years.min()),
                "median": None if birth_years.empty else float(birth_years.median()),
                "maximum": None if birth_years.empty else int(birth_years.max()),
            },
            "death_year": {
                "count": int(len(death_years)),
                "minimum": None if death_years.empty else int(death_years.min()),
                "median": None if death_years.empty else float(death_years.median()),
                "maximum": None if death_years.empty else int(death_years.max()),
            },
            "representative_artists": [
                {
                    "id": row.id,
                    "entity": row.entity,
                    "display_name": row.display_name,
                    "membership_probability": float(row.membership_probability),
                    "outlier_score": float(row.outlier_score),
                }
                for row in representatives.itertuples()
            ],
            "top_related_entities": top_related,
        })

    write_json(CLUSTER_PROFILES_PATH, {
        "cluster_count": len(profiles),
        "clusters": profiles,
        "note": "Profiles are descriptive summaries and do not define the clusters.",
    })
    print(f"Saved cluster profiles to {CLUSTER_PROFILES_PATH}")


def main() -> None:
    run()


if __name__ == "__main__":
    main()
