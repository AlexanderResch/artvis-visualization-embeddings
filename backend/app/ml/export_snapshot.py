import os
from collections import Counter

import pyarrow as pa
import pyarrow.parquet as pq
from neo4j import GraphDatabase

from app.ml.config import EDGES_PATH, NODES_PATH, SNAPSHOT_SUMMARY_PATH
from app.ml.utils import json_dumps, make_entity_identifier, select_node_type, write_json

NODE_SCHEMA = pa.schema([(name, pa.string()) for name in (
    "entity", "type", "id", "element_id", "labels_json", "properties_json",
)])
EDGE_SCHEMA = pa.schema([(name, pa.string()) for name in (
    "relationship_element_id", "source_entity", "source_element_id", "source_type",
    "source_id", "relation", "target_entity", "target_element_id", "target_type",
    "target_id", "properties_json",
)])


def write_batches(path, schema, rows, batch_size=50000):
    path.parent.mkdir(parents=True, exist_ok=True)
    count, batch = 0, []
    with pq.ParquetWriter(path, schema=schema, compression="zstd") as writer:
        for row in rows:
            batch.append(row)
            if len(batch) == batch_size:
                writer.write_table(pa.Table.from_pylist(batch, schema=schema))
                count += len(batch)
                batch.clear()
        if batch:
            writer.write_table(pa.Table.from_pylist(batch, schema=schema))
            count += len(batch)
    return count


def node_rows(session, counts):
    for row in session.run("""
        MATCH (n) RETURN labels(n) AS labels, elementId(n) AS element_id,
        n.id AS id, properties(n) AS properties
    """):
        kind = select_node_type(row["labels"])
        counts[kind] += 1
        yield {
            "entity": make_entity_identifier(kind, row["id"], row["element_id"]),
            "type": kind, "id": None if row["id"] is None else str(row["id"]),
            "element_id": row["element_id"], "labels_json": json_dumps(row["labels"]),
            "properties_json": json_dumps(row["properties"]),
        }


def edge_rows(session, counts):
    for row in session.run("""
        MATCH (s)-[r]->(t) RETURN elementId(r) AS relationship_element_id,
        labels(s) AS source_labels, elementId(s) AS source_element_id, s.id AS source_id,
        type(r) AS relation, labels(t) AS target_labels,
        elementId(t) AS target_element_id, t.id AS target_id, properties(r) AS properties
    """):
        result = {"relationship_element_id": row["relationship_element_id"],
                  "relation": row["relation"], "properties_json": json_dumps(row["properties"])}
        counts[row["relation"]] += 1
        for side in ("source", "target"):
            kind = select_node_type(row[f"{side}_labels"])
            node_id, element_id = row[f"{side}_id"], row[f"{side}_element_id"]
            result.update({f"{side}_type": kind, f"{side}_element_id": element_id,
                           f"{side}_id": None if node_id is None else str(node_id),
                           f"{side}_entity": make_entity_identifier(kind, node_id, element_id)})
        yield result


def run():
    if NODES_PATH.exists() or EDGES_PATH.exists():
        raise FileExistsError("Snapshot files already exist. Export into a fresh --input-dir.")
    auth = os.getenv("NEO4J_AUTH", "").split("/", 1)
    user = os.getenv("NEO4J_USER") or (auth[0] if len(auth) == 2 else "neo4j")
    password = os.getenv("NEO4J_PASSWORD") or (auth[1] if len(auth) == 2 else "")
    if not password:
        raise RuntimeError("Set NEO4J_AUTH or NEO4J_USER and NEO4J_PASSWORD for export.")
    kinds, relations = Counter(), Counter()
    with GraphDatabase.driver(os.getenv("NEO4J_URI", "bolt://artvis-db:7687"),
                              auth=(user, password)) as driver:
        with driver.session(database=os.getenv("NEO4J_DATABASE") or None,
                            fetch_size=5000) as session:
            nodes = write_batches(NODES_PATH, NODE_SCHEMA, node_rows(session, kinds))
            edges = write_batches(EDGES_PATH, EDGE_SCHEMA, edge_rows(session, relations))
    write_json(SNAPSHOT_SUMMARY_PATH, {
        "node_count": nodes, "edge_count": edges, "node_counts_by_type": kinds,
        "relationship_counts": relations,
        "properties_used_for_training": False,
    })
    print(f"Exported {nodes:,} nodes and {edges:,} relationships.", flush=True)


if __name__ == "__main__":
    run()
