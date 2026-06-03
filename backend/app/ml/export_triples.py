import os
import pandas as pd
from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://artvis-db:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "root1234")

OUTPUT_PATH = "app/ml/data/triples.tsv"


def node_identifier(node):
    labels = list(node.labels)
    label = labels[0] if labels else "Unlabeled"
    node_id = node.get("id")

    if node_id is None:
        node_id = node.element_id

    return f"{label}:{node_id}"


def main():
    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD)
    )

    query = """
    MATCH (h)-[r]->(t)
    WHERE size(labels(h)) > 0
      AND size(labels(t)) > 0
      AND type(r) <> 'CO_EXHIBITED'
    RETURN h, type(r) AS relation, t
    """

    rows = []

    with driver.session() as session:
        result = session.run(query)

        for record in result:
            rows.append({
                "head": node_identifier(record["h"]),
                "relation": record["relation"],
                "tail": node_identifier(record["t"])
            })

    driver.close()

    df = pd.DataFrame(rows)
    df.to_csv(OUTPUT_PATH, sep="\t", index=False, header=False)

    print(f"Exported {len(df)} triples to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()