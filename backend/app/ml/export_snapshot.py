from collections import Counter
from typing import Iterable

import pyarrow as pa
import pyarrow.parquet as pq

from neo4j import GraphDatabase

from app.ml.config import (
    EDGES_PATH,
    EXPORT_BATCH_SIZE,
    NEO4J_DATABASE,
    NEO4J_FETCH_SIZE,
    NEO4J_PASSWORD,
    NEO4J_URI,
    NEO4J_USER,
    NODES_PATH,
    SNAPSHOT_SUMMARY_PATH,
)

from app.ml.utils import (
    json_dumps,
    make_entity_identifier,
    select_node_type,
    write_json,
)


NODE_SCHEMA = pa.schema([
    ("entity", pa.string()),
    ("type", pa.string()),
    ("id", pa.string()),
    ("element_id", pa.string()),
    ("labels_json", pa.string()),
    ("properties_json", pa.string()),
])


EDGE_SCHEMA = pa.schema([
    (
        "relationship_element_id",
        pa.string(),
    ),
    ("source_entity", pa.string()),
    ("source_element_id", pa.string()),
    ("source_type", pa.string()),
    ("source_id", pa.string()),
    ("relation", pa.string()),
    ("target_entity", pa.string()),
    ("target_element_id", pa.string()),
    ("target_type", pa.string()),
    ("target_id", pa.string()),
    ("properties_json", pa.string()),
])


def write_batches(
        path,
        schema,
        rows: Iterable[dict],
        batch_size: int,
) -> int:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    writer = pq.ParquetWriter(
        path,
        schema=schema,
        compression="zstd",
    )

    count = 0
    batch: list[dict] = []

    try:
        for row in rows:
            batch.append(row)

            if len(batch) >= batch_size:
                table = pa.Table.from_pylist(
                    batch,
                    schema=schema,
                )

                writer.write_table(table)

                count += len(batch)
                batch.clear()

        if batch:
            table = pa.Table.from_pylist(
                batch,
                schema=schema,
            )

            writer.write_table(table)
            count += len(batch)

    finally:
        writer.close()

    return count


def node_rows(
        session,
        type_counts: Counter[str],
):
    query = """
    MATCH (node)

    RETURN
        labels(node) AS labels,
        elementId(node) AS element_id,
        node.id AS node_id,
        properties(node) AS properties
    """

    for record in session.run(query):
        labels = list(
            record["labels"] or []
        )

        node_type = select_node_type(
            labels
        )

        node_id = record["node_id"]

        element_id = str(
            record["element_id"]
        )

        entity = make_entity_identifier(
            node_type,
            node_id,
            element_id,
        )

        type_counts[node_type] += 1

        yield {
            "entity": entity,
            "type": node_type,

            "id": (
                None
                if node_id is None
                else str(node_id)
            ),

            "element_id": element_id,

            "labels_json": json_dumps(
                labels
            ),

            "properties_json": json_dumps(
                dict(
                    record["properties"]
                    or {}
                )
            ),
        }


def edge_rows(
        session,
        relation_counts: Counter[str],
):
    query = """
    MATCH
        (source)
        -[relationship]->
        (target)

    RETURN
        elementId(relationship)
            AS relationship_element_id,

        labels(source)
            AS source_labels,

        elementId(source)
            AS source_element_id,

        source.id
            AS source_id,

        type(relationship)
            AS relation,

        properties(relationship)
            AS properties,

        labels(target)
            AS target_labels,

        elementId(target)
            AS target_element_id,

        target.id
            AS target_id
    """

    for record in session.run(query):
        source_type = select_node_type(
            list(
                record[
                    "source_labels"
                ] or []
            )
        )

        target_type = select_node_type(
            list(
                record[
                    "target_labels"
                ] or []
            )
        )

        source_id = record["source_id"]
        target_id = record["target_id"]

        relation = str(
            record["relation"]
        )

        relation_counts[relation] += 1

        yield {
            "relationship_element_id": str(
                record[
                    "relationship_element_id"
                ]
            ),

            "source_entity": (
                make_entity_identifier(
                    source_type,
                    source_id,
                    str(
                        record[
                            "source_element_id"
                        ]
                    ),
                )
            ),

            "source_element_id": str(
                record[
                    "source_element_id"
                ]
            ),

            "source_type": source_type,

            "source_id": (
                None
                if source_id is None
                else str(source_id)
            ),

            "relation": relation,

            "target_entity": (
                make_entity_identifier(
                    target_type,
                    target_id,
                    str(
                        record[
                            "target_element_id"
                        ]
                    ),
                )
            ),

            "target_element_id": str(
                record[
                    "target_element_id"
                ]
            ),

            "target_type": target_type,

            "target_id": (
                None
                if target_id is None
                else str(target_id)
            ),

            "properties_json": json_dumps(
                dict(
                    record["properties"]
                    or {}
                )
            ),
        }


def run() -> None:
    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(
            NEO4J_USER,
            NEO4J_PASSWORD,
        ),
    )

    type_counts: Counter[str] = (
        Counter()
    )

    relation_counts: Counter[str] = (
        Counter()
    )

    session_arguments = {
        "fetch_size": NEO4J_FETCH_SIZE
    }

    if NEO4J_DATABASE:
        session_arguments[
            "database"
        ] = NEO4J_DATABASE

    try:
        with driver.session(
                **session_arguments
        ) as session:
            node_count = write_batches(
                NODES_PATH,
                NODE_SCHEMA,
                node_rows(
                    session,
                    type_counts,
                ),
                EXPORT_BATCH_SIZE,
            )

            edge_count = write_batches(
                EDGES_PATH,
                EDGE_SCHEMA,
                edge_rows(
                    session,
                    relation_counts,
                ),
                EXPORT_BATCH_SIZE,
            )

    finally:
        driver.close()

    summary = {
        "node_count": node_count,
        "edge_count": edge_count,

        "node_counts_by_type": dict(
            type_counts.most_common()
        ),

        "relationship_counts": dict(
            relation_counts.most_common()
        ),

        "nodes_path": NODES_PATH,
        "edges_path": EDGES_PATH,

        "contains_all_node_properties": True,

        "contains_all_relationship_properties": True,

        "contains_co_exhibited": (
                "CO_EXHIBITED"
                in relation_counts
        ),
    }

    write_json(
        SNAPSHOT_SUMMARY_PATH,
        summary,
    )

    print(
        f"Exported {node_count:,} "
        f"nodes to {NODES_PATH}"
    )

    print(
        f"Exported {edge_count:,} "
        f"relationships to "
        f"{EDGES_PATH}"
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()