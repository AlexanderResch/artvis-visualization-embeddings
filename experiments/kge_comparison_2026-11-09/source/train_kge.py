"""Train standard PyKEEN models and export aligned, real-valued artist vectors."""

import math
import time
from importlib.metadata import version

import numpy as np
import pandas as pd
import torch
from pykeen.models import ComplEx, DistMult, RotatE, TransE
from pykeen.sampling import negative_sampler_resolver
from pykeen.training import SLCWATrainingLoop
from pykeen.training.callbacks import TrainingCallback
from pykeen.triples import CoreTriplesFactory
from pykeen.utils import set_random_seed

from app.ml.config import (
    ADAM_FUSED, ARTIST_EMBEDDINGS_PATH, ARTIST_METADATA_PATH, DATA_DIR, DEVICE, EMBEDDING_DIM,
    EMBEDDING_SUMMARY_PATH, ENTITY_METADATA_PATH, FINAL_CHECKPOINT_PATH, INPUT_DATA_DIR,
    KGE_MODEL, LEARNING_RATE, NEGATIVE_SAMPLER, NEGATIVES_PER_POSITIVE, RANDOM_SEED,
    RELATION_MAPPING_PATH, TORCH_NUM_THREADS, TRAIN_BATCH_SIZE, TRAIN_EPOCHS,
    TRAINING_FINAL_PATH, TRIPLES_PATH,
)
from app.ml.prepare_training_data import file_hash
from app.ml.utils import read_json, write_json

MODELS = {cls.__name__: cls for cls in (TransE, DistMult, ComplEx, RotatE)}


class Progress(TrainingCallback):
    def __init__(self, total):
        super().__init__()
        self.total, self.batches = total, 0
        self.started = time.perf_counter()

    def post_batch(self, epoch, batch, **kwargs):
        self.batches += 1
        if self.batches % 500 == 0:
            print(f"Batch {self.batches}/{self.total}, {time.perf_counter() - self.started:.0f}s", flush=True)

    def post_epoch(self, epoch, epoch_loss, **kwargs):
        print(f"Epoch {epoch}: training loss = {epoch_loss:.6f}", flush=True)


def check_output_directory():
    if any(path.exists() for path in (TRAINING_FINAL_PATH, FINAL_CHECKPOINT_PATH, ARTIST_EMBEDDINGS_PATH)):
        raise FileExistsError(
            f"Training artifacts already exist in {DATA_DIR}. Use a fresh --data-dir and "
            "--input-dir to reuse prepared data without overwriting previous results."
        )


def export_vectors(vectors):
    """Concatenation preserves complex Euclidean distances without discarding imaginary parts."""
    if vectors.is_complex():
        vectors = torch.cat((vectors.real, vectors.imag), dim=-1)
    result = vectors.detach().cpu().numpy().astype(np.float32)
    if not np.isfinite(result).all() or np.any(np.linalg.norm(result, axis=1) == 0):
        raise ValueError("Artist embeddings must be finite, nonzero vectors.")
    return result


def run():
    check_output_directory()
    if TRAIN_EPOCHS < 1 or TRAIN_BATCH_SIZE < 1 or LEARNING_RATE <= 0:
        raise ValueError("Epochs, batch size, and learning rate must be positive.")
    set_random_seed(RANDOM_SEED)
    torch.set_num_threads(TORCH_NUM_THREADS)
    metadata = pd.read_parquet(ENTITY_METADATA_PATH).sort_values("global_index")
    if not np.array_equal(metadata.global_index, np.arange(len(metadata))):
        raise ValueError("Entity indices must be contiguous and match the prepared triples.")
    relations = read_json(RELATION_MAPPING_PATH)
    input_hashes = {path.name: file_hash(path) for path in (
        ENTITY_METADATA_PATH, RELATION_MAPPING_PATH, TRIPLES_PATH,
    )}
    factory = CoreTriplesFactory(
        mapped_triples=torch.from_numpy(np.load(TRIPLES_PATH)),
        num_entities=len(metadata), num_relations=len(relations), create_inverse_triples=False,
    )
    device = ("cuda" if torch.cuda.is_available() else "cpu") if DEVICE == "auto" else DEVICE
    complex_model = KGE_MODEL in {"ComplEx", "RotatE"}
    native_dimension = EMBEDDING_DIM // 2 if complex_model else EMBEDDING_DIM
    model_kwargs = {"embedding_dim": native_dimension}
    if KGE_MODEL == "TransE":
        model_kwargs["scoring_fct_norm"] = 1
    # Losses, regularizers, and constraints retain each PyKEEN model's defaults.
    model = MODELS[KGE_MODEL](
        triples_factory=factory, random_seed=RANDOM_SEED, **model_kwargs,
    ).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, fused=True if ADAM_FUSED else None)
    loop = SLCWATrainingLoop(
        model=model, triples_factory=factory, optimizer=optimizer,
        negative_sampler=NEGATIVE_SAMPLER,
        negative_sampler_kwargs={"num_negs_per_pos": NEGATIVES_PER_POSITIVE, "filtered": True},
    )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    progress = Progress(math.ceil(factory.num_triples / TRAIN_BATCH_SIZE) * TRAIN_EPOCHS)
    print(f"Training {KGE_MODEL}: {native_dimension} native dimensions, {EMBEDDING_DIM} real features.", flush=True)
    started = time.perf_counter()
    losses = loop.train(
        triples_factory=factory, num_epochs=TRAIN_EPOCHS, batch_size=TRAIN_BATCH_SIZE,
        use_tqdm=False, callbacks=progress, drop_last=False, num_workers=0,
        pin_memory=device.startswith("cuda"),
    )
    duration = time.perf_counter() - started
    model.cpu().eval()
    artists = metadata.loc[metadata["type"].eq("Artist")].copy().reset_index(drop=True)
    artists.insert(0, "artist_index", np.arange(len(artists)))
    with torch.inference_mode():
        indices = torch.as_tensor(artists.global_index.to_numpy(), dtype=torch.long)
        vectors = model.entity_representations[0](indices=indices)
        embeddings = export_vectors(vectors)
    if embeddings.shape != (len(artists), EMBEDDING_DIM):
        raise ValueError("Unexpected real embedding dimension.")
    norms = np.linalg.norm(embeddings, axis=1)
    if KGE_MODEL in {"TransE", "DistMult"} and not np.allclose(norms, 1.0, atol=1e-5):
        raise ValueError(f"{KGE_MODEL}'s default entity constraint must produce unit L2 norms.")
    torch.save({
        "model": KGE_MODEL, "model_kwargs": model_kwargs, "state_dict": model.state_dict(),
        "embedding_dim": native_dimension, "exported_real_dimension": EMBEDDING_DIM,
        "num_entities": len(metadata), "num_relations": len(relations), "random_seed": RANDOM_SEED,
    }, FINAL_CHECKPOINT_PATH)
    np.save(ARTIST_EMBEDDINGS_PATH, embeddings)
    artists.to_csv(ARTIST_METADATA_PATH, index=False)
    write_json(TRAINING_FINAL_PATH, {
        "model": KGE_MODEL, "library": "PyKEEN", "pykeen_version": version("pykeen"),
        "torch_version": torch.__version__, "device": device, "random_seed": RANDOM_SEED,
        "torch_num_threads": TORCH_NUM_THREADS,
        "entity_count": len(metadata), "relation_count": len(relations),
        "triple_count": factory.num_triples, "embedding_dimension": EMBEDDING_DIM,
        "model_embedding_dimension": native_dimension, "complex_valued": complex_model,
        "model_kwargs": model_kwargs,
        "real_parameter_count": sum(p.numel() * (2 if p.is_complex() else 1) for p in model.parameters()),
        "epochs": TRAIN_EPOCHS, "batch_size": TRAIN_BATCH_SIZE,
        "optimizer": "Adam", "adam_fused": ADAM_FUSED, "learning_rate": LEARNING_RATE, "loss": str(model.loss),
        "negative_sampler": negative_sampler_resolver.lookup(loop.negative_sampler).__name__,
        "negative_sampler_key": NEGATIVE_SAMPLER,
        "negative_samples_per_positive": NEGATIVES_PER_POSITIVE,
        "optimizer_updates": progress.batches, "processed_positive_examples": factory.num_triples * TRAIN_EPOCHS,
        "library_versions": {name: version(name) for name in ("torch", "pykeen", "numpy", "scikit-learn", "hdbscan")},
        "known_positive_filter": "PyKEEN BloomFilterer",
        "model_defaults": "PyKEEN defaults for loss, regularization, and constraints; no custom architecture.",
        "training_loss": losses, "training_seconds": duration,
        "input_data_dir": str(INPUT_DATA_DIR.resolve()), "prepared_data_sha256": input_hashes,
        "training_scope": "All supplied triples; training loss is not held-out predictive performance.",
    })
    write_json(EMBEDDING_SUMMARY_PATH, {
        "model": KGE_MODEL, "artist_count": len(artists), "embedding_dimension": EMBEDDING_DIM,
        "model_embedding_dimension": native_dimension,
        "representation": "concatenated real and imaginary parts" if complex_model else "real vectors",
        "l2_norm_minimum": norms.min(), "l2_norm_maximum": norms.max(),
        "additional_l2_normalization": False,
    })
    print(f"Saved {len(artists):,} {KGE_MODEL} artist embeddings ({EMBEDDING_DIM} real features).", flush=True)


if __name__ == "__main__":
    run()
