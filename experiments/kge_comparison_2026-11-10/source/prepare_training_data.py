"""Create unique graph triples and retain metadata for connected entities."""

import hashlib
import json

import duckdb
import numpy as np
import pandas as pd

from app.ml.config import (
    DATA_DIR, EDGES_PATH, ENTITY_METADATA_PATH, EXCLUDED_RELATIONS,
    INDEXED_EDGES_PATH, INPUT_DATA_DIR, MODEL_NODE_TYPES, NODES_PATH, PREPARE_SUMMARY_PATH,
    RELATION_MAPPING_PATH, TRIPLES_PATH,
)
from app.ml.utils import display_name, first_value, parse_year, write_json


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def prepare(nodes: pd.DataFrame, edges: pd.DataFrame, excluded_relations=EXCLUDED_RELATIONS):
    """Only entities occurring in retained triples receive trained embeddings."""
    nodes = nodes.loc[nodes["type"].isin(MODEL_NODE_TYPES)].copy()
    if nodes["entity"].duplicated().any():
        raise ValueError("Snapshot has duplicate entity identifiers; resolve them before training.")
    available = set(nodes["entity"])
    retained = edges.loc[
        ~edges["relation"].isin(excluded_relations)
        & edges["source_entity"].isin(available)
        & edges["target_entity"].isin(available)
        & ~(edges["relation"].eq("CO_EXHIBITED") & edges["source_entity"].eq(edges["target_entity"])),
        ["source_entity", "relation", "target_entity"],
    ].drop_duplicates()
    # Keep ordinary triples in the same order when the extra relation is included.
    retained = retained.assign(_coex=retained["relation"].eq("CO_EXHIBITED")).sort_values(
        ["_coex", "source_entity", "relation", "target_entity"],
    ).drop(columns="_coex")
    if retained.empty:
        raise ValueError("No training triples remain after filtering.")
    connected = set(retained["source_entity"]) | set(retained["target_entity"])
    nodes = nodes.loc[nodes["entity"].isin(connected)].sort_values("entity").reset_index(drop=True)
    rows = []
    for index, row in enumerate(nodes.itertuples(index=False)):
        properties = json.loads(row.properties_json or "{}")
        rows.append({
            "global_index": index, "entity": row.entity, "type": row.type,
            "id": row.id, "element_id": row.element_id,
            "display_name": display_name(row.type, properties, row.entity),
            "birth_year": parse_year(first_value(properties, ("birthyear", "birthYear", "birth_year", "birthdate"))),
            "death_year": parse_year(first_value(properties, ("deathyear", "deathYear", "death_year", "deathdate"))),
            "nationality": first_value(properties, ("nationality", "nation", "country", "countryCode")),
            "gender": first_value(properties, ("gender", "sex")),
            "properties_json": row.properties_json,
        })
    metadata = pd.DataFrame(rows)
    entities = dict(zip(metadata["entity"], metadata["global_index"], strict=True))
    relation_names = sorted(set(retained["relation"]) - {"CO_EXHIBITED"})
    if "CO_EXHIBITED" in set(retained["relation"]):
        relation_names.append("CO_EXHIBITED")
    relations = {name: index for index, name in enumerate(relation_names)}
    indexed = pd.DataFrame({
        "head": retained["source_entity"].map(entities).to_numpy(),
        "relation": retained["relation"].to_numpy(),
        "tail": retained["target_entity"].map(entities).to_numpy(),
    })
    triples = np.column_stack((indexed["head"], indexed["relation"].map(relations), indexed["tail"]))
    return metadata, indexed, triples.astype(np.int64), relations


def run():
    if DATA_DIR.resolve() != INPUT_DATA_DIR.resolve():
        raise ValueError("Preparation requires ML_INPUT_DIR and ML_DATA_DIR to be the same directory.")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    nodes = pd.read_parquet(NODES_PATH)
    # Apply the relation filter in the scan instead of loading millions of excluded edges.
    with duckdb.connect() as connection:
        excluded = list(EXCLUDED_RELATIONS)
        edges = connection.execute("""
            SELECT source_entity, relation, target_entity
            FROM read_parquet(?) WHERE relation NOT IN (SELECT unnest(?::VARCHAR[]))
        """, [str(EDGES_PATH), excluded]).fetch_df()
        counts = connection.execute(
            "SELECT relation, count(*) n FROM read_parquet(?) GROUP BY relation ORDER BY relation",
            [str(EDGES_PATH)],
        ).fetch_df()
    metadata, indexed, triples, relations = prepare(nodes, edges)
    metadata.to_parquet(ENTITY_METADATA_PATH, index=False, compression="zstd")
    indexed.to_parquet(INDEXED_EDGES_PATH, index=False, compression="zstd")
    np.save(TRIPLES_PATH, triples)
    write_json(RELATION_MAPPING_PATH, relations)
    write_json(PREPARE_SUMMARY_PATH, {
        "model_entity_count": len(metadata), "indexed_edge_count": len(triples),
        "model_node_types": metadata["type"].value_counts().to_dict(),
        "relation_counts": indexed["relation"].value_counts().to_dict(),
        "snapshot_relation_counts": dict(zip(counts.relation, counts.n, strict=True)),
        "excluded_relations": list(EXCLUDED_RELATIONS),
        "excluded_unconnected_artists": int(nodes["type"].eq("Artist").sum() - metadata["type"].eq("Artist").sum()),
        "properties_used_for_training": False, "duplicate_triples_removed": True,
        "training_scope": "All retained triples; no held-out link-prediction evaluation.",
        "snapshot_sha256": {"nodes": file_hash(NODES_PATH), "edges": file_hash(EDGES_PATH)},
    })
    print(f"Prepared {len(triples):,} triples, {len(metadata):,} connected entities, {len(relations)} relations.", flush=True)


if __name__ == "__main__":
    run()
