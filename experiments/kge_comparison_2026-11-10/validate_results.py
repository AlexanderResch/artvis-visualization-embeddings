import argparse
from datetime import datetime, timezone
import hashlib
from itertools import combinations, product
import json
from pathlib import Path

import numpy as np
import pandas as pd


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def independent_pair_counts(artists, labels, reference):
    memberships = reference.groupby("artist_entity").group_entity.agg(set).to_dict()
    assigned = dict(zip(artists.entity, labels, strict=True))
    counts = dict.fromkeys(("pair_tp", "pair_fp", "pair_fn", "pair_tn"), 0)
    for left, right in combinations(sorted(memberships), 2):
        truth = bool(memberships[left] & memberships[right])
        label = assigned.get(left, -1)
        predicted = label >= 0 and label == assigned.get(right, -1)
        key = ("pair_tp" if predicted else "pair_fn") if truth else ("pair_fp" if predicted else "pair_tn")
        counts[key] += 1
    return counts


def validate(root):
    completion = read(root / "completion.json")
    assert completion["status"] == "complete", "Run the finalizer before validating."
    protocol = read(root / "protocol.json")
    freeze = read(root / "selection_manifest.json")
    publication = read(root / "publication_protocol.json")
    input_dir = Path(protocol["input_dir"])
    models, seeds = protocol["models"], protocol["confirmation_seeds"]
    assert completion["reference_test_evaluated_after_selection"]
    assert completion["confirmation_runs"] == 20 and completion["tuning_candidates"] == 48
    for name, expected in protocol["input_sha256"].items():
        assert digest(input_dir / name) == expected, name
    assert "MEMBER_OF" not in read(input_dir / "relation_mapping.json")
    source = read(root / "source_sha256.json")["files"]
    for entry in source:
        assert digest(root / "source" / entry["path"]) == entry["sha256"], entry["path"]
    for entry in read(root / "publication_source_sha256.json")["files"]:
        assert digest(root / "publication_source" / entry["path"]) == entry["sha256"], entry["path"]
    assert digest(root / "publication_source" / "finalize_models.py") == publication["finalizer_sha256"]
    reference = pd.read_parquet(input_dir / "group_reference.parquet")
    assert reference.groupby("artist_entity").split.nunique().eq(1).all()
    tuning = pd.read_parquet(root / "tuning_results.parquet")
    expected = set(product(models, ("native", "adjusted"), (2, 4), protocol["representations"]))
    assert set(tuning[["model", "configuration", "epochs", "representation"]].itertuples(index=False, name=None)) == expected
    assert len(tuning) == len(expected)
    confirmations = pd.read_parquet(root / "confirmation_runs.parquet")
    assert set(confirmations[["model", "seed"]].itertuples(index=False, name=None)) == set(product(models, seeds))
    assert len(confirmations) == 20
    cross = pd.read_parquet(root / "cross_seed_stability.parquet")
    assert len(cross) == 40
    catalog = read(root.parent.parent / "data_models" / "manifest.json")
    assert set(catalog["models"]) == {model.lower() for model in models}
    common_entities = None
    references_checked = 0
    for model in models:
        selection = read(root / model.lower() / "selection.json")
        assert digest(root / model.lower() / "selection.json") == freeze["selection_sha256"][model]
        pairs = cross.loc[cross.model.eq(model)]
        assert set(pairs[["seed_left", "seed_right"]].itertuples(index=False, name=None)) == set(combinations(seeds, 2))
        for seed in seeds:
            report = read(root / "evaluation" / model.lower() / f"seed_{seed}" / "evaluation_final.json")
            run = Path(report["run_dir"])
            training = read(run / "training_final.json")
            assert training["model"] == model and training["random_seed"] == seed
            assert training["epochs"] == selection["epochs"]
            assert training["learning_rate"] == selection["config"]["learning_rate"]
            assert training["model_kwargs"].get("regularizer_kwargs", {}).get("weight") == selection["config"]["regularizer_weight"]
            assert training["excluded_group_memberships"]
            assert training["embedding_dimension"] == 64
            assert training["model_embedding_dimension"] == (32 if model in {"ComplEx", "RotatE"} else 64)
            assert training["batch_size"] == 2048 and training["negative_samples_per_positive"] == 1
            assert training["torch_num_threads"] == 2 and training["adam_fused"]
            for name, expected_hash in training["prepared_data_sha256"].items():
                assert expected_hash == protocol["input_sha256"][name]
            assert digest(run / "artist_embeddings.npy") == report["embedding_sha256"]
            assert digest(run / f"{model.lower()}.pt") == report["checkpoint_sha256"]
            vectors = np.load(run / "artist_embeddings.npy")
            artists = pd.read_parquet(run / "artist_metadata.parquet")
            labels = np.load(root / model.lower() / "evaluation" / f"seed_{seed}" / "labels.npy")
            assert vectors.shape == (protocol["training_artist_count"], 64) and np.isfinite(vectors).all()
            if model in {"TransE", "DistMult"}:
                assert np.allclose(np.linalg.norm(vectors, axis=1), 1.0, atol=1e-5)
            assert labels.shape == (len(artists),)
            if common_entities is None:
                common_entities = artists.entity
            assert artists.entity.equals(common_entities)
            assert int(np.sum(labels >= 0)) == report["assigned_count"]
            assert len(np.unique(labels[labels >= 0])) == report["cluster_count"]
            assert np.isclose(np.mean(labels < 0), report["noise_fraction"])
            for split in ("validation", "test"):
                counts = independent_pair_counts(artists, labels, reference.loc[reference.split.eq(split)])
                assert all(value == report[split][key] for key, value in counts.items()), (model, seed, split)
                tp, fp, fn = (counts[key] for key in ("pair_tp", "pair_fp", "pair_fn"))
                expected_f1 = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.0
                assert np.isclose(expected_f1, report[split]["pair_f1"], rtol=0, atol=1e-12)
                references_checked += 1
            if seed == freeze["representative_seeds"][model]:
                output = root.parent.parent / "data_models" / model.lower()
                assert not list(output.glob("*.csv"))
                for filename in ("artist_embeddings.npy", f"{model.lower()}.pt"):
                    assert digest(output / filename) == digest(run / filename)
                assert catalog["models"][model.lower()]["seed"] == seed
                clusters = pd.read_parquet(output / "artist_clusters.parquet")
                assert np.array_equal(clusters.entity.to_numpy(), common_entities.to_numpy())
                assert np.array_equal(clusters.cluster, labels)
                for dimension in (2, 3):
                    frame = pd.read_parquet(output / f"artist_map_{dimension}d.parquet")
                    assert np.array_equal(frame.entity.to_numpy(), common_entities.to_numpy())
                    assert np.array_equal(frame.cluster, labels)
                    assert np.isfinite(frame[list("xyz"[:dimension])]).all().all()
                assert read(output / "group_evaluation.json")["test"] == report["test"]
    jobs = list(root.glob("*/tuning/*/seed_41/training_final.json")) + list(root.glob("*/confirmation/seed_*/training_final.json"))
    assert len(jobs) == 24
    result = {
        "status": "passed", "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_jobs": len(jobs), "tuning_candidates": len(tuning), "confirmation_runs": len(confirmations),
        "independent_reference_pair_comparisons": references_checked, "seed_pairs": len(cross),
        "published_models": len(models), "frozen_training_source_files": len(source),
        "checks": ["Frozen inputs, sources and configuration selections", "Common artist ordering and finite 64-feature vectors",
                   "Selected epochs, learning rates, regularization and label exclusion",
                   "Primary pair counts independently recomputed using set intersections for both label splits",
                   "Checkpoint and embedding hashes", "Published representative runs, cluster labels and both map dimensions",
                   "Parquet application tables without duplicate CSV exports"],
    }
    (root / "integrity_checks.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    validate(parser.parse_args().root)
