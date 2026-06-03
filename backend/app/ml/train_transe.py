import numpy as np
import pandas as pd
import torch

from pykeen.pipeline import pipeline
from pykeen.triples import TriplesFactory

TRIPLES_PATH = "app/ml/data/triples.tsv"
EMBEDDINGS_PATH = "app/ml/data/entity_embeddings.npy"
ENTITY_IDS_PATH = "app/ml/data/entity_ids.tsv"


def main():
    triples_factory = TriplesFactory.from_path(
        TRIPLES_PATH,
        delimiter="\t",
        create_inverse_triples=True
    )

    training, testing, validation = triples_factory.split(
        ratios=[0.8, 0.1, 0.1],
        random_state=42
    )

    result = pipeline(
        training=training,
        testing=testing,
        validation=validation,
        model="TransE",
        model_kwargs={
            "embedding_dim": 128
        },
        training_kwargs={
            "num_epochs": 50,
            "batch_size": 1024
        },
        optimizer="Adam",
        optimizer_kwargs={
            "lr": 0.001
        },
        random_seed=42,
        device="cuda" if torch.cuda.is_available() else "cpu"
    )

    model = result.model

    entity_embeddings = model.entity_representations[0](
        indices=None
    ).detach().cpu().numpy()

    entity_to_id = triples_factory.entity_to_id
    id_to_entity = {idx: entity for entity, idx in entity_to_id.items()}

    entity_ids = [id_to_entity[i] for i in range(len(id_to_entity))]

    np.save(EMBEDDINGS_PATH, entity_embeddings)

    pd.DataFrame({"entity": entity_ids}).to_csv(
        ENTITY_IDS_PATH,
        sep="\t",
        index=False
    )

    result.save_to_directory("app/ml/data/transe_model")

    print("TransE training finished.")
    print(f"Saved embeddings to {EMBEDDINGS_PATH}")
    print(f"Saved entity ids to {ENTITY_IDS_PATH}")


if __name__ == "__main__":
    main()