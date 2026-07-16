import numpy as np
import pandas as pd
import torch

from app.ml.attribute_complex import AttributeEnhancedComplEx
from app.ml.config import (
    ARTIST_EMBEDDINGS_PATH,
    ARTIST_METADATA_PATH,
    ATTRIBUTE_FEATURES_PATH,
    EMBEDDING_BATCH_SIZE,
    EMBEDDING_SUMMARY_PATH,
    ENTITY_EMBEDDINGS_PATH,
    ENTITY_IDS_PATH,
    ENTITY_METADATA_PATH,
    EVALUATION_CHECKPOINT_PATH,
    FINAL_CHECKPOINT_PATH,
    TYPE_IDS_PATH,
)
from app.ml.train_attribute_complex import _device
from app.ml.utils import write_json


def _load_model(checkpoint_path, device):
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model = AttributeEnhancedComplEx(
        num_entities=int(checkpoint["num_entities"]),
        num_relations=int(checkpoint["num_relations"]),
        num_types=int(checkpoint["num_types"]),
        attribute_dim=int(checkpoint["attribute_dim"]),
        complex_dim=int(checkpoint["complex_dim"]),
        attribute_hidden_dim=int(checkpoint["attribute_hidden_dim"]),
        dropout=float(checkpoint["dropout"]),
    ).to(device)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model, checkpoint


@torch.no_grad()
def run() -> None:
    checkpoint_path = FINAL_CHECKPOINT_PATH if FINAL_CHECKPOINT_PATH.exists() else EVALUATION_CHECKPOINT_PATH
    if not checkpoint_path.exists():
        raise FileNotFoundError("Train the evaluation or final model first")

    device = _device()
    model, checkpoint = _load_model(checkpoint_path, device)
    metadata = pd.read_parquet(ENTITY_METADATA_PATH).sort_values("global_index").reset_index(drop=True)
    attributes = torch.from_numpy(
        np.array(np.load(ATTRIBUTE_FEATURES_PATH, mmap_mode="r"), copy=True)
    ).float().to(device)
    type_ids = torch.from_numpy(np.load(TYPE_IDS_PATH)).long().to(device)

    embeddings = np.empty((len(metadata), 2 * model.complex_dim), dtype=np.float32)
    for start in range(0, len(metadata), EMBEDDING_BATCH_SIZE):
        stop = min(start + EMBEDDING_BATCH_SIZE, len(metadata))
        indices_np = np.arange(start, stop, dtype=np.int64)
        indices = torch.from_numpy(indices_np).long().to(device)
        vectors = model.entity_representation(
            indices,
            attributes[indices],
            type_ids[indices],
        )
        embeddings[start:stop] = vectors.cpu().numpy()

    np.save(ENTITY_EMBEDDINGS_PATH, embeddings)
    pd.DataFrame({"entity": metadata["entity"]}).to_csv(ENTITY_IDS_PATH, sep="\t", index=False)

    artist_mask = metadata["type"].eq("Artist").to_numpy()
    artist_embeddings = embeddings[artist_mask]
    artist_metadata = metadata.loc[artist_mask].reset_index(drop=True).copy()
    artist_metadata.insert(0, "artist_index", np.arange(len(artist_metadata), dtype=np.int64))
    np.save(ARTIST_EMBEDDINGS_PATH, artist_embeddings)
    artist_metadata.to_csv(ARTIST_METADATA_PATH, index=False)

    write_json(EMBEDDING_SUMMARY_PATH, {
        "checkpoint": checkpoint_path,
        "checkpoint_mode": checkpoint.get("mode"),
        "entity_count": len(metadata),
        "artist_count": len(artist_metadata),
        "embedding_dimension": embeddings.shape[1],
        "entity_embeddings": ENTITY_EMBEDDINGS_PATH,
        "artist_embeddings": ARTIST_EMBEDDINGS_PATH,
    })
    print(f"Saved {len(artist_metadata):,} Artist embeddings to {ARTIST_EMBEDDINGS_PATH}")


def main() -> None:
    run()


if __name__ == "__main__":
    main()
