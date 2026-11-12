import argparse
import os
from pathlib import Path
import subprocess
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import silhouette_score
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize
from threadpoolctl import threadpool_limits

from app.ml.assess_clustering import exhibition_matrix, fit, graph_agreement, matched_jaccard
from app.ml.cluster_artists import representation
from app.ml.group_evaluation import evaluate_groups
from app.ml.prepare_training_data import file_hash
from app.ml.utils import read_json, write_json

REPRESENTATIONS = ("raw", "l2", "l2_pca10")


def transform(vectors, name):
    vectors = normalize(vectors).astype(np.float32) if name != "raw" else vectors
    return representation(vectors, name == "l2_pca10", 10)[0]


def score_run(directory, input_dir, name, reference, graph_checks=False):
    vectors = np.load(directory / "artist_embeddings.npy")
    artists = pd.read_parquet(directory / "artist_metadata.parquet")
    if len(vectors) != len(artists) or not np.isfinite(vectors).all():
        raise ValueError("Artist embeddings are not aligned.")
    transformed = transform(vectors, name)
    model = fit(transformed, 50, 5)
    labels = model.labels_
    groups, sizes = np.unique(labels[labels >= 0], return_counts=True)
    generator = np.random.default_rng(2026)
    sample = generator.choice(len(vectors), min(2000, len(vectors)), replace=False)
    subsets = [np.sort(generator.choice(len(vectors), int(.8 * len(vectors)), replace=False)) for _ in range(3)]
    stability = []
    if len(groups):
        for subset in subsets:
            repeated = fit(transform(vectors[subset], name), 50, 5).labels_
            stability.append(matched_jaccard(labels[subset], repeated))
    assigned = sample[labels[sample] >= 0]
    separation = None
    if 1 < len(np.unique(labels[assigned])) < len(assigned):
        separation = float(silhouette_score(normalize(vectors[assigned]), labels[assigned]))
    result = {
        "representation": name, "artist_count": len(artists), "cluster_count": len(groups),
        "assigned_count": int(np.sum(labels >= 0)), "noise_fraction": float(np.mean(labels < 0)),
        "largest_cluster_fraction": float(sizes.max() / len(labels)) if len(sizes) else None,
        "cluster_sizes": dict(zip(groups.tolist(), sizes.tolist(), strict=True)),
        "silhouette_l2": separation, "silhouette_assigned_sample_count": len(assigned),
        "subsample_jaccard": stability, "subsample_jaccard_mean": float(np.mean(stability)) if stability else None,
        "mean_cluster_persistence": float(np.mean(model.cluster_persistence_)) if len(groups) else None,
        "relative_validity_approx": float(model.relative_validity_) if len(groups) else None,
        "validation": evaluate_groups(artists, labels, reference),
    }
    if graph_checks:
        edges = pd.read_parquet(input_dir / "indexed_edges.parquet", filters=[("relation", "==", "EXHIBITED_AT")])
        graph = exhibition_matrix(artists, edges)
        indices = NearestNeighbors(n_neighbors=11, algorithm="brute", n_jobs=1).fit(transformed).kneighbors(transformed, return_distance=False)
        neighbors = np.stack([row[row != index][:10] for index, row in enumerate(indices)])
        queries = np.repeat(np.arange(len(vectors)), 10)
        shared = graph[queries].multiply(graph[neighbors.ravel()]).sum(axis=1)
        result["nearest10_shared_exhibition"] = float((np.asarray(shared).ravel() > 0).mean())
        result.update(graph_agreement(labels, graph, 2026))
    return result, labels


def train(model, config, seed, epochs, input_dir, directory, checkpoints=()):
    if (directory / "training_final.json").exists():
        training = read_json(directory / "training_final.json")
        if training["model"] != model or training["random_seed"] != seed or training["epochs"] != epochs:
            raise ValueError("Existing run does not match the protocol.")
        return
    environment = {**os.environ, "ML_DEVICE": "cpu", "ADAM_FUSED": "true", "TORCH_NUM_THREADS": "2",
                   "OMP_NUM_THREADS": "2", "MKL_NUM_THREADS": "2", "OPENBLAS_NUM_THREADS": "2",
                   "TRAIN_BATCH_SIZE": "2048", "LEARNING_RATE": str(config["learning_rate"]),
                   "NEGATIVE_SAMPLER": "pseudo_typed", "NEGATIVES_PER_POSITIVE": "1",
                   "CHECKPOINT_EPOCHS": ",".join(map(str, checkpoints))}
    environment.pop("KGE_REGULARIZER_WEIGHT", None)
    if config.get("regularizer_weight") is not None:
        environment["KGE_REGULARIZER_WEIGHT"] = str(config["regularizer_weight"])
    directory.mkdir(parents=True, exist_ok=True)
    command = [sys.executable, "-u", "-m", "app.ml.run_pipeline", "--model", model,
               "--input-dir", str(input_dir), "--data-dir", str(directory), "--seed", str(seed),
               "--embedding-dim", "64", "--epochs", str(epochs), "--steps", "train"]
    print(f"Starting {model} {config['name']} seed {seed}, {epochs} epochs.", flush=True)
    with (directory / "training.log").open("w", encoding="utf-8") as log:
        subprocess.run(command, env=environment, stdout=log, stderr=subprocess.STDOUT, check=True)
    print(f"Completed {model} {config['name']} seed {seed}.", flush=True)


def ranking(candidate):
    return (candidate["validation"]["pair_f1"], candidate["subsample_jaccard_mean"] or 0,
            -candidate["noise_fraction"], -candidate["epochs"])


def worker(root, model):
    protocol = read_json(root / "protocol.json")
    input_dir = Path(protocol["input_dir"])
    reference = pd.read_parquet(input_dir / "group_reference.parquet")
    reference = reference.loc[reference.split.eq("validation")]
    if "MEMBER_OF" in read_json(input_dir / "relation_mapping.json"):
        raise ValueError("Reference memberships must be absent from the training graph.")
    for name, expected in protocol["input_sha256"].items():
        if file_hash(input_dir / name) != expected:
            raise ValueError(f"Input changed: {name}")
    destination = root / model.lower()
    destination.mkdir(parents=True, exist_ok=True)
    candidates = []
    with threadpool_limits(limits=2):
        for config in protocol["configurations"][model]:
            directory = destination / "tuning" / config["name"] / "seed_41"
            train(model, config, 41, 4, input_dir, directory, checkpoints=(2,))
            for epochs in (2, 4):
                run = directory / "epoch_2" if epochs == 2 else directory
                for name in REPRESENTATIONS:
                    candidate_path = run / f"evaluation_{name}.json"
                    if candidate_path.exists():
                        result = read_json(candidate_path)
                    else:
                        result, labels = score_run(run, input_dir, name, reference)
                        result.update(model=model, config=config, epochs=epochs, seed=41, run_dir=str(run))
                        np.save(run / f"labels_{name}.npy", labels)
                        write_json(candidate_path, result)
                    candidates.append(result)
                    print({"model": model, "config": config["name"], "epochs": epochs,
                           "representation": name, "clusters": result["cluster_count"],
                           "validation_pair_f1": result["validation"]["pair_f1"]}, flush=True)
            pd.DataFrame([{**{key: row[key] for key in ("model", "epochs", "representation", "noise_fraction", "cluster_count", "subsample_jaccard_mean")},
                           "configuration": row["config"]["name"], **row["validation"]} for row in candidates]).to_parquet(
                destination / "tuning_results.parquet", index=False, compression="zstd")
        selected = max(candidates, key=ranking)
        selection_path = destination / "selection.json"
        selection = {key: selected[key] for key in ("model", "config", "epochs", "representation", "run_dir", "validation")}
        selection["selection_rule"] = protocol["selection_rule"]
        if selection_path.exists() and read_json(selection_path) != selection:
            raise ValueError("A frozen selection cannot be changed during confirmation.")
        write_json(selection_path, selection)
        print(f"Frozen selection for {model}: {selection}", flush=True)
        for seed in protocol["confirmation_seeds"]:
            run = Path(selected["run_dir"]) if seed == 41 else destination / "confirmation" / f"seed_{seed}"
            if seed != 41:
                train(model, selected["config"], seed, selected["epochs"], input_dir, run)
            output = destination / "evaluation" / f"seed_{seed}"
            output.mkdir(parents=True, exist_ok=True)
            if not (output / "evaluation.json").exists():
                result, labels = score_run(run, input_dir, selected["representation"], reference, graph_checks=True)
                result.update(model=model, seed=seed, epochs=selected["epochs"], config=selected["config"], run_dir=str(run))
                np.save(output / "labels.npy", labels)
                write_json(output / "evaluation.json", result)
            print(f"Evaluated confirmation {model}, seed {seed}.", flush=True)
    write_json(destination / "worker_complete.json", {"model": model, "seeds": protocol["confirmation_seeds"],
               "test_labels_used": False, "status": "complete"})


def initialize(root, input_dir):
    if (root / "protocol.json").exists():
        raise FileExistsError("This experiment already has a protocol.")
    metadata = pd.read_parquet(input_dir / "entity_metadata.parquet")
    reference = pd.read_parquet(input_dir / "group_reference.parquet")
    models = ("TransE", "DistMult", "ComplEx", "RotatE")
    configurations = {model: [
        {"name": "native", "learning_rate": .001, "regularizer_weight": None},
        {"name": "adjusted", "learning_rate": .01,
         "regularizer_weight": .001 if model in {"DistMult", "ComplEx"} else None},
    ] for model in models}
    root.mkdir(parents=True)
    protocol = {
        "experiment": "Group-reference KGE refinement, 2026-11-10", "input_dir": str(input_dir.resolve()),
        "models": models, "configurations": configurations, "checkpoint_epochs": [2, 4],
        "tuning_seed": 41, "confirmation_seeds": [41, 42, 43, 44, 45],
        "real_dimension": 64, "batch_size": 2048, "optimizer": "Adam", "adam_fused": True,
        "negative_sampler": "pseudo_typed", "negatives_per_positive": 1,
        "device": "cpu", "torch_threads_per_worker": 2, "maximum_concurrent_training_workers": 4,
        "representations": REPRESENTATIONS, "hdbscan": {"min_cluster_size": 50, "min_samples": 5,
            "metric": "euclidean", "cluster_selection_method": "eom", "approx_min_span_tree": False},
        "selection_rule": "Per model: highest validation pair-F1; ties: artist-subset Jaccard, lower noise, fewer epochs. Only validation artists are scored before configurations are frozen.",
        "reference_definition": "Two labeled artists match if they share at least one recorded Group. Predicted match requires the same non-noise cluster. Missing embeddings and noise do not create positive pairs.",
        "secondary_reference_scores": "ARI and AMI on artists with exactly one known Group, with noise as individual singletons.",
        "label_split": read_json(input_dir / "group_reference_summary.json"),
        "training_artist_count": int(metadata.type.eq("Artist").sum()),
        "labeled_artists_with_embeddings": int(reference.artist_entity.drop_duplicates().isin(metadata.entity).sum()),
        "input_sha256": {name: file_hash(input_dir / name) for name in (
            "entity_metadata.parquet", "triples.npy", "relation_mapping.json", "indexed_edges.parquet", "group_reference.parquet",
        )},
        "limitations": ["Finite two-configuration search; no claim of exhaustive optimization or convergence.",
                        "The adjusted configurations change learning rate and, for regularized models, regularization together; this is not an isolated causal comparison of those parameters.",
                        "Transductive clustering uses the full structural graph, excluding MEMBER_OF. Held-out labels do not constitute held-out link prediction.",
                        "Group labels can overlap and be incomplete; a disjoint clustering cannot necessarily recover all pairwise group overlaps.",
                        "Subsampling holds trained embeddings fixed. Exhibition agreement uses training facts."],
    }
    write_json(root / "protocol.json", protocol)
    source = root / "source"
    source.mkdir()
    hashes = []
    for path in sorted(Path(__file__).parent.glob("*.py")):
        (source / path.name).write_bytes(path.read_bytes())
        hashes.append({"path": path.name, "sha256": file_hash(path)})
    write_json(root / "source_sha256.json", {"files": hashes})
    print(protocol, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--input-dir", type=Path)
    parser.add_argument("--initialize", action="store_true")
    parser.add_argument("--model", choices=("TransE", "DistMult", "ComplEx", "RotatE"))
    arguments = parser.parse_args()
    if arguments.initialize:
        initialize(arguments.root, arguments.input_dir)
    elif arguments.model:
        worker(arguments.root, arguments.model)
    else:
        parser.error("Use --initialize or --model.")


if __name__ == "__main__":
    main()
