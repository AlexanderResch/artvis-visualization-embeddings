"""Optional, isolated TransE comparison with and without CO_EXHIBITED.

Run both conditions, then the report. Application artifacts are never replaced.
The common parameters start identically; the training-example budgets are close,
not identical, because each condition uses complete passes through its triples.
"""

import argparse
import gc
import hashlib
import math
import time
from importlib.metadata import version

import duckdb
import joblib
import numpy as np
import pandas as pd
import torch
from pykeen.models import TransE
from pykeen.training import SLCWATrainingLoop
from pykeen.training.callbacks import TrainingCallback
from pykeen.triples import CoreTriplesFactory
from pykeen.utils import set_random_seed
from scipy import sparse
from sklearn.neighbors import NearestNeighbors
from threadpoolctl import threadpool_limits

from app.ml.cluster_artists import fit_clustering
from app.ml.compare_pca import compare
from app.ml.config import (
    ARTIST_EMBEDDINGS_PATH, ARTIST_METADATA_PATH, DATA_DIR, EDGES_PATH,
    ENTITY_METADATA_PATH, HDBSCAN_MIN_CLUSTER_SIZE, HDBSCAN_MIN_SAMPLES,
    HDBSCAN_SUMMARY_PATH, INDEXED_EDGES_PATH, NODES_PATH, PREPARE_SUMMARY_PATH,
    RELATION_MAPPING_PATH, TORCH_NUM_THREADS, TRAINING_FINAL_PATH, TRIPLES_PATH,
)
from app.ml.prepare_training_data import file_hash
from app.ml.utils import read_json, write_json

EXPERIMENT_DIR = DATA_DIR / "coexhibition_comparison"


def baseline_inputs():
    settings = read_json(TRAINING_FINAL_PATH)
    preparation = read_json(PREPARE_SUMMARY_PATH)
    clustering = read_json(HDBSCAN_SUMMARY_PATH)["selected_parameters"]
    if settings["model"] != "TransE" or preparation["excluded_relations"] != ["CO_EXHIBITED"]:
        raise ValueError("Expected the existing TransE baseline without CO_EXHIBITED.")
    for name, path in (("nodes", NODES_PATH), ("edges", EDGES_PATH)):
        if file_hash(path) != preparation["snapshot_sha256"][name]:
            raise ValueError("The snapshot has changed since baseline preparation.")
    if (clustering["min_cluster_size"], clustering["min_samples"]) != (
        HDBSCAN_MIN_CLUSTER_SIZE, HDBSCAN_MIN_SAMPLES,
    ):
        raise ValueError("Use the baseline HDBSCAN parameters for this comparison.")
    return settings, preparation


def add_coexhibitions(metadata, ordinary, relations):
    """Append observed, unique directed pairs; preserve all existing entity/relation IDs."""
    if "CO_EXHIBITED" in relations:
        raise ValueError("The supplied baseline already includes CO_EXHIBITED.")
    with duckdb.connect() as connection:
        connection.execute("SET threads=4")
        connection.register("metadata", metadata)
        source_count = connection.execute("""
            SELECT count(DISTINCT (source_entity, target_entity))
            FROM read_parquet(?) WHERE relation='CO_EXHIBITED'
              AND source_entity<>target_entity
        """, [str(EDGES_PATH)]).fetchone()[0]
        pairs = connection.execute("""
            SELECT DISTINCT source.global_index AS head, target.global_index AS tail
            FROM read_parquet(?) edge
            JOIN metadata source ON source.entity=edge.source_entity
            JOIN metadata target ON target.entity=edge.target_entity
            WHERE edge.relation='CO_EXHIBITED'
              AND source.type='Artist' AND target.type='Artist'
              AND source.global_index<>target.global_index
            ORDER BY head, tail
        """, [str(EDGES_PATH)]).fetchnumpy()
    if not source_count or len(pairs["head"]) != source_count:
        raise ValueError("CO_EXHIBITED endpoints do not match the baseline artist population.")
    augmented_relations = {**relations, "CO_EXHIBITED": len(relations)}
    coex = np.column_stack((pairs["head"], np.full(source_count, len(relations)), pairs["tail"]))
    return np.concatenate((ordinary, coex)).astype(np.int64, copy=False), augmented_relations


def initial_model(factory, baseline_factory, settings, include_coex):
    kwargs = {"embedding_dim": settings["embedding_dimension"],
              "scoring_fct_norm": settings["scoring_fct_norm"],
              "random_seed": settings["random_seed"]}
    # Adding a relation can change RNG consumption during initialization. Copy
    # common parameters explicitly instead of relying on the seed alone.
    model = TransE(triples_factory=factory, **kwargs) if include_coex else None
    reference = TransE(triples_factory=baseline_factory, **kwargs)
    digest = hashlib.sha256()
    for name, parameter in reference.named_parameters():
        digest.update(name.encode())
        digest.update(parameter.detach().numpy().tobytes())
    if model is None:
        return reference, digest.hexdigest()
    with torch.no_grad():
        targets = dict(model.named_parameters())
        for name, parameter in reference.named_parameters():
            target = targets[name]
            if name.startswith("relation_representations."):
                target = target[:baseline_factory.num_relations]
            if target.shape != parameter.shape:
                raise ValueError(f"Cannot match initial parameter {name}.")
            target.copy_(parameter)
            if not torch.equal(target, parameter):
                raise ValueError("Shared parameter initialization differs.")
    return model, digest.hexdigest()


class Progress(TrainingCallback):
    def __init__(self, condition, total):
        super().__init__()
        self.condition, self.total, self.count = condition, total, 0
        self.started = time.perf_counter()

    def post_batch(self, epoch, batch, **kwargs):
        self.count += 1
        if self.count % 250 == 0:
            elapsed = time.perf_counter() - self.started
            print(f"{self.condition}: batch {self.count}/{self.total}, {elapsed:.0f}s", flush=True)

    def post_epoch(self, epoch, epoch_loss, **kwargs):
        print(f"{self.condition}: epoch {epoch}, training loss {epoch_loss:.6f}", flush=True)


def train(condition, sampler="basic"):
    settings, preparation = baseline_inputs()
    label = condition if sampler == "basic" else f"{condition}_{sampler}"
    output = EXPERIMENT_DIR / label
    output.mkdir(parents=True, exist_ok=True)
    if (output / "training_final.json").exists():
        raise FileExistsError(f"Completed experiment already exists: {output}")
    include_coex = condition == "with_coexhibitions"
    set_random_seed(settings["random_seed"])
    torch.set_num_threads(TORCH_NUM_THREADS)
    metadata = pd.read_parquet(ENTITY_METADATA_PATH).sort_values("global_index")
    ordinary = np.load(TRIPLES_PATH)
    relations = read_json(RELATION_MAPPING_PATH)
    baseline_factory = CoreTriplesFactory(
        mapped_triples=torch.from_numpy(ordinary), num_entities=len(metadata),
        num_relations=len(relations), create_inverse_triples=False,
    )
    triples, mapping = add_coexhibitions(metadata, ordinary, relations) if include_coex else (ordinary, relations)
    factory = CoreTriplesFactory(
        mapped_triples=torch.from_numpy(triples), num_entities=len(metadata),
        num_relations=len(mapping), create_inverse_triples=False,
    )
    budget = len(ordinary) * settings["epochs"]
    epochs = max(1, round(budget / len(triples)))
    batches = math.ceil(len(triples) / settings["batch_size"]) * epochs
    model, initialization_hash = initial_model(factory, baseline_factory, settings, include_coex)
    gc.collect()
    optimizer = torch.optim.Adam(model.parameters(), lr=settings["learning_rate"])
    loop = SLCWATrainingLoop(
        model=model, triples_factory=factory, optimizer=optimizer, negative_sampler=sampler,
        negative_sampler_kwargs={"num_negs_per_pos": settings["negative_samples_per_positive"], "filtered": True},
    )
    progress = Progress(label, batches)
    manifest = {
        "condition": condition, "source_snapshot_sha256": preparation["snapshot_sha256"],
        "historical_baseline_torch_version": settings["torch_version"],
        "library_versions": {name: version(name) for name in ("torch", "pykeen", "numpy", "scikit-learn", "hdbscan")},
        "model": "TransE", "device": "cpu", "torch_num_threads": TORCH_NUM_THREADS,
        "random_seed": settings["random_seed"], "embedding_dimension": settings["embedding_dimension"],
        "scoring_fct_norm": settings["scoring_fct_norm"], "entity_constraint": "unit L2 norm",
        "entity_count": len(metadata), "relation_mapping": mapping, "triple_count": len(triples),
        "coexhibition_triple_count": len(triples) - len(ordinary),
        "coexhibition_handling": "Observed directed pairs, exact duplicates removed, no self-pairs.",
        "common_initial_parameters_sha256": initialization_hash,
        "epochs": epochs, "batch_size": settings["batch_size"], "learning_rate": settings["learning_rate"],
        "optimizer": "Adam", "negative_sampler": sampler, "filtered_negatives": True,
        "negative_samples_per_positive": settings["negative_samples_per_positive"],
        "processed_positive_examples": len(triples) * epochs,
        "historical_baseline_positive_examples": budget,
        "training_example_budget_ratio": len(triples) * epochs / budget,
        "optimizer_updates": batches,
    }
    write_json(output / "manifest.json", manifest)
    print(f"{label}: {len(triples):,} triples, {epochs} epochs, {batches} updates", flush=True)
    started = time.perf_counter()
    losses = loop.train(
        triples_factory=factory, num_epochs=epochs, batch_size=settings["batch_size"],
        callbacks=progress, use_tqdm=False, num_workers=0, drop_last=False, pin_memory=False,
    )
    artists = pd.read_csv(ARTIST_METADATA_PATH, dtype={"id": str, "entity": str})
    model.eval()
    with torch.inference_mode():
        indices = torch.as_tensor(artists.global_index.to_numpy(), dtype=torch.long)
        embeddings = model.entity_representations[0](indices=indices).numpy().astype(np.float32)
    if not np.isfinite(embeddings).all() or not np.allclose(np.linalg.norm(embeddings, axis=1), 1, atol=1e-5):
        raise ValueError("Exported artist vectors are not finite unit vectors.")
    np.save(output / "artist_embeddings.npy", embeddings)
    torch.save({"state_dict": model.state_dict(), "manifest": manifest}, output / "transe.pt")
    write_json(output / "training_final.json", {
        **manifest, "training_seconds": time.perf_counter() - started,
        "training_loss": losses, "completed_optimizer_updates": progress.count,
        "embedding_sha256": file_hash(output / "artist_embeddings.npy"),
    })
    print(f"{label}: training complete.", flush=True)


def neighbor_alignment(embeddings, artists, edges, seed):
    """In-sample graph alignment, not an independent predictive evaluation."""
    memberships = edges.loc[edges.relation.eq("EXHIBITED_AT")].copy()
    indices = dict(zip(artists.global_index, np.arange(len(artists)), strict=True))
    memberships["artist_index"] = memberships["head"].map(indices)
    memberships = memberships.dropna(subset=["artist_index"])
    exhibitions = {key: index for index, key in enumerate(sorted(memberships["tail"].unique()))}
    matrix = sparse.csr_matrix((np.ones(len(memberships)), (
        memberships.artist_index.astype(int), memberships["tail"].map(exhibitions),
    )), shape=(len(artists), len(exhibitions)))
    k = min(10, len(artists) - 1)
    neighbors = NearestNeighbors(n_neighbors=k, n_jobs=1).fit(embeddings).kneighbors(return_distance=False)
    rows = np.repeat(np.arange(len(artists)), k)
    offsets = np.random.default_rng(seed).integers(1, len(artists), len(rows))
    random = (rows + offsets) % len(artists)
    def fraction(partners):
        shared = np.asarray(matrix[rows].multiply(matrix[partners]).sum(axis=1)).ravel() > 0
        return float(shared.mean())
    return {"k": k, "nearest_shared_exhibition_fraction": fraction(neighbors.ravel()),
            "random_shared_exhibition_fraction": fraction(random),
            "scope": "Shared exhibitions from training relationships, not held-out evaluation."}


def report(sampler="basic"):
    settings, _ = baseline_inputs()
    artists = pd.read_csv(ARTIST_METADATA_PATH, dtype={"id": str, "entity": str})
    edges = pd.read_parquet(INDEXED_EDGES_PATH)
    results = {}
    for condition in ("without_coexhibitions", "with_coexhibitions"):
        label = condition if sampler == "basic" else f"{condition}_{sampler}"
        directory = EXPERIMENT_DIR / label
        training = read_json(directory / "training_final.json")
        embeddings = np.load(directory / "artist_embeddings.npy")
        pca = compare(embeddings)
        write_json(directory / "pca_comparison.json", pca)
        model = fit_clustering(embeddings)
        labels = artists.copy()
        labels["cluster"] = model.labels_
        labels["membership_probability"] = model.probabilities_
        labels["outlier_score"] = model.outlier_scores_
        labels.to_csv(directory / "artist_clusters.csv", index=False)
        joblib.dump(model, directory / "artist_hdbscan.joblib")
        profiles = []
        for cluster_id, group in labels.loc[labels.cluster >= 0].groupby("cluster"):
            years = pd.to_numeric(group.birth_year, errors="coerce").dropna()
            profiles.append({"cluster": int(cluster_id), "artist_count": len(group),
                             "median_birth_year": float(years.median()) if len(years) else None,
                             "top_nationalities": group.nationality.dropna().value_counts().head(5).to_dict(),
                             "representatives": group.sort_values("membership_probability", ascending=False)
                             [["id", "display_name", "membership_probability"]].head(5).to_dict("records")})
        write_json(directory / "cluster_descriptions.json", {
            "clusters": profiles, "note": "Descriptive metadata, not reference cluster labels.",
        })
        results[condition] = {"training": training, "clustering": pca,
                              "embedding_geometry": {
                                  "unique_artist_vectors": len(np.unique(embeddings, axis=0)),
                                  "norm_of_mean_artist_vector": float(np.linalg.norm(embeddings.mean(axis=0))),
                              },
                              "neighborhood_alignment": neighbor_alignment(embeddings, artists, edges, settings["random_seed"])}
    left, right = (results[key]["training"] for key in ("without_coexhibitions", "with_coexhibitions"))
    for field in ("common_initial_parameters_sha256", "library_versions", "source_snapshot_sha256", "entity_count"):
        if left[field] != right[field]:
            raise ValueError(f"Conditions differ in {field}; do not interpret this as a controlled comparison.")
    historical_hash = file_hash(ARTIST_EMBEDDINGS_PATH)
    filename = "comparison.json" if sampler == "basic" else f"comparison_{sampler}.json"
    write_json(EXPERIMENT_DIR / filename, {
        "conditions": results,
        "historical_baseline_embedding_sha256": historical_hash,
        "control_reproduces_historical_embeddings": left["embedding_sha256"] == historical_hash,
        "limitations": [
            "Single seed, approximate matching of processed-example budgets; this is exploratory evidence.",
            "Adding CO_EXHIBITED changes relation frequencies. Ordinary triples are seen twice versus 40 times.",
            "Cluster quality has no ground-truth labels; more clusters do not establish better semantic groups.",
            "Neighborhood alignment uses training graph facts and is not independent predictive accuracy.",
            "The historical application model is retained; neither experiment replaces its artifacts.",
        ],
    })
    print(f"Saved comparison to {EXPERIMENT_DIR / filename}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("condition", choices=("without_coexhibitions", "with_coexhibitions", "report"))
    parser.add_argument("--sampler", choices=("basic", "pseudo_typed"), default="basic")
    arguments = parser.parse_args()
    with threadpool_limits(limits=TORCH_NUM_THREADS):
        report(arguments.sampler) if arguments.condition == "report" else train(arguments.condition, arguments.sampler)


if __name__ == "__main__":
    main()
