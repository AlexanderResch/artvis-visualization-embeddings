import numpy as np
import pandas as pd
import umap

EMBEDDINGS_PATH = "app/ml/data/entity_embeddings.npy"
ENTITY_IDS_PATH = "app/ml/data/entity_ids.tsv"

OUTPUT_2D = "app/ml/data/embedding_2d.csv"
OUTPUT_3D = "app/ml/data/embedding_3d.csv"


def split_entity(entity):
    if ":" not in entity:
        return "Unknown", entity

    entity_type, entity_id = entity.split(":", 1)
    return entity_type, entity_id


def main():
    embeddings = np.load(EMBEDDINGS_PATH)
    entities = pd.read_csv(ENTITY_IDS_PATH, sep="\t")

    entities[["type", "id"]] = entities["entity"].apply(
        lambda value: pd.Series(split_entity(value))
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