"""Descriptive cluster profiles; metadata does not participate in training."""

import duckdb
import pandas as pd

from app.ml.config import (
    ARTIST_CLUSTERS_PATH, CLUSTER_PROFILES_PATH, ENTITY_METADATA_PATH, INDEXED_EDGES_PATH,
)
from app.ml.utils import write_json


def year_summary(values):
    years = pd.to_numeric(values, errors="coerce").dropna()
    return {"count": len(years),
            "minimum": int(years.min()) if len(years) else None,
            "median": float(years.median()) if len(years) else None,
            "maximum": int(years.max()) if len(years) else None}


def run():
    artists = pd.read_csv(ARTIST_CLUSTERS_PATH, dtype={"id": str, "entity": str})
    assigned = artists.loc[~artists.is_noise].copy()
    if assigned.empty:
        write_json(CLUSTER_PROFILES_PATH, {"cluster_count": 0, "clusters": []})
        return
    metadata = pd.read_parquet(ENTITY_METADATA_PATH)
    edges = pd.read_parquet(INDEXED_EDGES_PATH)
    with duckdb.connect() as connection:
        connection.register("artists", assigned)
        connection.register("metadata", metadata)
        connection.register("edges", edges)
        related = connection.execute("""
            WITH neighbors AS (
                SELECT a.cluster, e.relation, m.type, m.entity, m.display_name
                FROM artists a JOIN edges e ON a.global_index=e.head
                JOIN metadata m ON m.global_index=e.tail
                UNION ALL
                SELECT a.cluster, e.relation, m.type, m.entity, m.display_name
                FROM artists a JOIN edges e ON a.global_index=e.tail
                JOIN metadata m ON m.global_index=e.head
            ), counted AS (
                SELECT cluster, relation, type, entity, display_name, count(*) n
                FROM neighbors WHERE type<>'Artist' GROUP BY ALL
            )
            SELECT * FROM counted
            QUALIFY row_number() OVER (
                PARTITION BY cluster, relation, type ORDER BY n DESC, entity
            ) <= 10
            ORDER BY cluster, relation, type, n DESC, entity
        """).fetch_df()
    profiles = []
    for cluster_id, group in assigned.groupby("cluster"):
        representatives = group.sort_values(
            ["membership_probability", "outlier_score", "entity"], ascending=[False, True, True],
        ).head(10)
        neighbors = related.loc[related.cluster.eq(cluster_id)]
        top_related = {}
        for (relation, kind), rows in neighbors.groupby(["relation", "type"]):
            top_related[f"{relation}:{kind}"] = [
                {"entity": row.entity, "display_name": row.display_name, "count": int(row.n)}
                for row in rows.itertuples(index=False)
            ]
        profiles.append({
            "cluster": int(cluster_id), "artist_count": len(group),
            "mean_membership_probability": group.membership_probability.mean(),
            "mean_outlier_score": group.outlier_score.mean(),
            "birth_year": year_summary(group.birth_year), "death_year": year_summary(group.death_year),
            "representative_artists": representatives[["id", "entity", "display_name",
                                                       "membership_probability", "outlier_score"]].to_dict("records"),
            "top_related_entities": top_related,
        })
    write_json(CLUSTER_PROFILES_PATH, {
        "cluster_count": len(profiles), "clusters": profiles,
        "note": "Descriptive metadata summaries; they neither define nor validate the clusters.",
    })
    print(f"Saved {len(profiles)} cluster profiles.", flush=True)


if __name__ == "__main__":
    run()
