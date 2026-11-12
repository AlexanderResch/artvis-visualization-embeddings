"""Run an isolated, fixed-configuration comparison of standard PyKEEN models."""

import argparse
import os
from pathlib import Path
import subprocess
import sys

import pandas as pd

from app.ml.config import SUPPORTED_MODELS
from app.ml.prepare_training_data import file_hash
from app.ml.utils import read_json, write_json

INPUT_FILES = ("entity_metadata.parquet", "relation_mapping.json", "triples.npy")


def compare(input_dir, output_dir, models, seeds, dimension, epochs):
    input_dir, output_dir = input_dir.resolve(), output_dir.resolve()
    if output_dir.exists():
        raise FileExistsError(f"Comparison output already exists: {output_dir}. Choose a fresh directory.")
    if len(set(models)) != len(models) or len(set(seeds)) != len(seeds):
        raise ValueError("Models and seeds must not contain duplicates.")
    if epochs < 1 or dimension < 2 or any(seed < 0 for seed in seeds):
        raise ValueError("Use positive epochs, at least two real dimensions, and non-negative seeds.")
    if dimension % 2 and {"ComplEx", "RotatE"}.intersection(models):
        raise ValueError("Complex models require an even exported real dimension.")
    hashes = {name: file_hash(input_dir / name) for name in INPUT_FILES}
    manifest = {
        "status": "running", "input_dir": str(input_dir), "prepared_data_sha256": hashes,
        "models": models, "seeds": seeds, "exported_real_dimension": dimension, "epochs": epochs,
        "protocol": "Fixed settings with native PyKEEN model defaults; no hyperparameter optimization or automatic winner selection.",
        "supervised_evaluation": "Not run: reference groups and their evaluation protocol have not been supplied.",
        "limitations": [
            "Equal real dimensions and training passes do not guarantee equal optimization or computational cost.",
            "Training uses all supplied triples; this is not held-out link-prediction evaluation.",
            "Raw embedding norms and model-specific defaults differ; preprocessing is not tuned in this comparison.",
            "Silhouette excludes noise, so it must be interpreted together with coverage and cluster sizes.",
        ],
    }
    output_dir.mkdir(parents=True)
    write_json(output_dir / "comparison.json", manifest)
    rows = []
    for model in models:
        for seed in seeds:
            run_dir = output_dir / model.lower() / f"seed_{seed}"
            command = [
                sys.executable, "-u", "-m", "app.ml.run_pipeline", "--model", model,
                "--seed", str(seed), "--embedding-dim", str(dimension), "--epochs", str(epochs),
                "--input-dir", str(input_dir), "--data-dir", str(run_dir), "--steps", "train", "cluster",
            ]
            print(f"\nComparing {model}, seed {seed}: {run_dir}", flush=True)
            try:
                subprocess.run(command, env=os.environ.copy(), check=True)
                training = read_json(run_dir / "training_final.json")
                clustering = read_json(run_dir / "hdbscan_summary.json")
                if training["prepared_data_sha256"] != hashes:
                    raise ValueError("Prepared inputs changed during the comparison.")
                rows.append({
                    "model": model, "seed": seed, "real_dimension": training["embedding_dimension"],
                    "native_dimension": training["model_embedding_dimension"],
                    "real_parameter_count": training["real_parameter_count"],
                    "epochs": training["epochs"], "optimizer_updates": training["optimizer_updates"],
                    "training_seconds": training["training_seconds"],
                    "loss": training["loss"].split("(", 1)[0],
                    "negative_sampler": training["negative_sampler"],
                    "clustering_dimension": clustering["clustering_dimension"],
                    "pca": clustering["input_mode"] == "pca",
                    "min_cluster_size": clustering["selected_parameters"]["min_cluster_size"],
                    "min_samples": clustering["selected_parameters"]["min_samples"],
                    "cluster_selection_method": clustering["selected_parameters"]["cluster_selection_method"],
                    **clustering["selected_metrics"], "run_dir": str(run_dir),
                })
                pd.DataFrame(rows).to_parquet(output_dir / "comparison.parquet", index=False, compression="zstd")
            except Exception:
                manifest.update(status="failed", failed_model=model, failed_seed=seed)
                write_json(output_dir / "comparison.json", manifest)
                raise
    frame = pd.DataFrame(rows)
    metrics = ("training_seconds", "cluster_count", "noise_fraction", "silhouette_original_space",
               "relative_validity", "mean_cluster_persistence")
    manifest.update(status="complete", runs=rows, model_summary={})
    for model, group in frame.groupby("model", sort=False):
        manifest["model_summary"][model] = {
            metric: {"mean": group[metric].mean(), "sample_std": group[metric].std(),
                     "valid_runs": int(group[metric].notna().sum())}
            for metric in metrics
        }
    write_json(output_dir / "comparison.json", manifest)
    print(f"Saved comparison table: {output_dir / 'comparison.parquet'}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True, help="One prepared snapshot shared by every run.")
    parser.add_argument("--output-dir", type=Path, required=True, help="Fresh directory outside the active application artifacts.")
    parser.add_argument("--models", nargs="+", choices=list(SUPPORTED_MODELS.values()),
                        default=list(SUPPORTED_MODELS.values()))
    parser.add_argument("--seeds", nargs="+", type=int, default=[41, 42, 43])
    parser.add_argument("--embedding-dim", type=int, default=64, help="Exported real dimension for every model.")
    parser.add_argument("--epochs", type=int, required=True, help="Explicit training passes for this fixed-settings experiment.")
    arguments = parser.parse_args()
    compare(arguments.input_dir, arguments.output_dir, arguments.models, arguments.seeds,
            arguments.embedding_dim, arguments.epochs)


if __name__ == "__main__":
    main()
