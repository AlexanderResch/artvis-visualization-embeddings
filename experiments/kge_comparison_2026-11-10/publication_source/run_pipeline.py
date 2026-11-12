"""Run the offline pipeline, or selected steps in the supplied order."""

import argparse
import os
from importlib import import_module

STEPS = {
    "export": "export_snapshot", "prepare": "prepare_training_data", "train": "train_kge",
    "compare_pca": "compare_pca", "cluster": "cluster_artists", "project": "project_umap",
    "materialize": "materialize_map", "profile": "profile_clusters",
}


def main():
    parser = argparse.ArgumentParser(description="PyKEEN KGE → HDBSCAN / UMAP")
    parser.add_argument("--model", choices=("TransE", "DistMult", "ComplEx", "RotatE"))
    parser.add_argument("--data-dir", help="Output directory; use a fresh directory for training.")
    parser.add_argument("--input-dir", help="Reuse a prepared snapshot without copying it.")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--embedding-dim", type=int, help="Exported real dimension; must be even for complex models.")
    parser.add_argument("--epochs", type=int)
    parser.add_argument("--steps", nargs="+", choices=list(STEPS),
                        default=[name for name in STEPS if name != "compare_pca"])
    arguments = parser.parse_args()
    for argument, variable in (("model", "KGE_MODEL"), ("data_dir", "ML_DATA_DIR"),
                               ("input_dir", "ML_INPUT_DIR"), ("seed", "ML_RANDOM_SEED"),
                               ("embedding_dim", "KGE_EMBEDDING_DIM"), ("epochs", "TRAIN_EPOCHS")):
        value = getattr(arguments, argument)
        if value is not None:
            os.environ[variable] = str(value)
    # Configure paths before importing any step; each CLI invocation is one run.
    from app.ml.config import DATA_DIR, INPUT_DATA_DIR
    if {"export", "prepare"}.intersection(arguments.steps) and DATA_DIR.resolve() != INPUT_DATA_DIR.resolve():
        parser.error("With --input-dir different from --data-dir, reuse prepared data starting at train.")
    if "train" in arguments.steps:
        from app.ml.train_kge import check_output_directory
        check_output_directory()
    for name in arguments.steps:
        print(f"\nRunning {name}", flush=True)
        import_module(f"app.ml.{STEPS[name]}").run()


if __name__ == "__main__":
    main()
