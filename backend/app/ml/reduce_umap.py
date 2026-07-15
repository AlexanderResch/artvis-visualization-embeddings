import os
import numpy as np
import pandas as pd
import umap

from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://artvis-db:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "root1234")

EMBEDDINGS_PATH = "app/ml/data/entity_embeddings.npy"
ENTITY_IDS_PATH = "app/ml/data/entity_ids.tsv"

OUTPUT_2D = "app/ml/data/embedding_2d.csv"
OUTPUT_3D = "app/ml/data/embedding_3d.csv"

DISPLAY_NAME_PROPERTIES = {
    "Artist": "sortname",
    "Exhibition": "title",
    "Geoname": "name",
    "Group": "name",
    "Item": "title",
    "Location": "name",
    "Organizer": "name",
    "Venue": "name",
}


def split_entity(entity):
    if ":" not in entity:
        return "Unknown", entity

    entity_type, entity_id = entity.split(":", 1)
    return entity_type, entity_id


def fallback_display_name(entity_type, entity_id):
    return f"{entity_type}:{entity_id}"


def get_display_name(entity_type, properties, entity_id):
    property_name = DISPLAY_NAME_PROPERTIES.get(entity_type)

    if property_name:
        value = properties.get(property_name)

        if value:
            return value

    return fallback_display_name(entity_type, entity_id)


def load_metadata_from_neo4j():
    driver = GraphDatabase.driver(
        NEO4J_URI,
        auth=(NEO4J_USER, NEO4J_PASSWORD)
    )

    query = """
    MATCH (n)
    WHERE size(labels(n)) > 0
      AND n.id IS NOT NULL
    RETURN labels(n)[0] AS type, toString(n.id) AS id, properties(n) AS properties
    """

    metadata = {}

    with driver.session() as session:
        result = session.run(query)

        for record in result:
            entity_type = record["type"]
            entity_id = record["id"]
            properties = dict(record["properties"])

            entity_key = f"{entity_type}:{entity_id}"

            metadata[entity_key] = {
                "display_name": get_display_name(
                    entity_type,
                    properties,
                    entity_id
                )
            }

    driver.close()

    return metadata


def main():
    embeddings = np.load(EMBEDDINGS_PATH)
    entities = pd.read_csv(ENTITY_IDS_PATH, sep="\t")

    entities[["type", "id"]] = entities["entity"].apply(
        lambda value: pd.Series(split_entity(value))
    )

    print("Loading display names from Neo4j...")
    metadata = load_metadata_from_neo4j()

    entities["display_name"] = entities.apply(
        lambda row: metadata.get(
            row["entity"],
            {
                "display_name": fallback_display_name(
                    row["type"],
                    row["id"]
                )
            }
        )["display_name"],
        axis=1
    )

    reducer_2d = umap.UMAP(
        n_components=2,
        random_state=42,
        metric="euclidean"
    )

    coords_2d = reducer_2d.fit_transform(embeddings)

    df_2d = entities.copy()
    df_2d["x"] = coords_2d[:, 0]
    df_2d["y"] = coords_2d[:, 1]
    df_2d.to_csv(OUTPUT_2D, index=False)

    reducer_3d = umap.UMAP(
        n_components=3,
        random_state=42,
        metric="euclidean"
    )

    coords_3d = reducer_3d.fit_transform(embeddings)

    df_3d = entities.copy()
    df_3d["x"] = coords_3d[:, 0]
    df_3d["y"] = coords_3d[:, 1]
    df_3d["z"] = coords_3d[:, 2]
    df_3d.to_csv(OUTPUT_3D, index=False)

    print(f"Saved 2D coordinates to {OUTPUT_2D}")
    print(f"Saved 3D coordinates to {OUTPUT_3D}")


if __name__ == "__main__":
    main()