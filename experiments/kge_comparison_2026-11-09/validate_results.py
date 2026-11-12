"""Check that completed comparison artifacts match the declared protocol."""

from datetime import datetime, timezone
from itertools import combinations
from pathlib import Path
import hashlib
import json

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    protocol = read(ROOT / "protocol.json")
    summary = read(ROOT / "evaluation_summary.json")
    assert summary["status"] == "complete" and summary["completed_runs"] == 12
    assert len(summary["summary"]) == 12
    assert all(row["completed_seeds"] == 3 for row in summary["summary"])
    assert len(summary["cross_seed_stability"]) == 36
    assert len(pd.read_csv(ROOT / "evaluation_runs.csv")) == 36
    source = read(ROOT / "source_sha256.json")
    for entry in source:
        assert digest(ROOT / "source" / entry["path"]) == entry["sha256"]
    expected = {(model, seed) for model in protocol["models"] for seed in protocol["seeds"]}
    observed = set()
    artifacts = []
    analysis_digest = digest(ROOT / "analyze.py")
    for path in sorted(ROOT.glob("*/*/seed_*/training_final.json")):
        training = read(path)
        model, seed = training["model"], training["random_seed"]
        key = (model, seed)
        assert key in expected and key not in observed
        observed.add(key)
        assert training["epochs"] == 2 and training["optimizer_updates"] == 7960
        assert training["processed_positive_examples"] == 16301060
        assert training["triple_count"] == 8150530 and training["entity_count"] == 225529
        assert training["embedding_dimension"] == 64
        assert training["model_embedding_dimension"] == protocol["native_dimensions"][model]
        assert training["adam_fused"] and training["torch_num_threads"] == 2
        assert training["device"] == "cpu" and training["negative_sampler"] == "PseudoTypedNegativeSampler"
        for name, value in training["prepared_data_sha256"].items():
            assert value == protocol["prepared_input_sha256"][name]
        run = path.parent
        vectors = np.load(run / "artist_embeddings.npy")
        assert vectors.shape == (13265, 64) and np.isfinite(vectors).all()
        evaluated = ROOT / "evaluation" / model.lower() / f"seed_{seed}"
        report = read(evaluated / "evaluation.json")
        assert report["embedding_sha256"] == digest(run / "artist_embeddings.npy")
        assert report["analysis_sha256"] == analysis_digest
        native_labels = pd.read_csv(run / "artist_clusters.csv", usecols=["cluster"]).cluster.to_numpy()
        for representation in protocol["preprocessing"]:
            labels = np.load(evaluated / f"labels_{representation}.npy")
            metrics = report["representations"][representation]
            assert labels.shape == (13265,)
            assert int(np.sum(labels >= 0)) == metrics["assigned_count"]
            assert len(np.unique(labels[labels >= 0])) == metrics["cluster_count"]
            assert np.isclose(float(np.mean(labels < 0)), metrics["noise_fraction"])
            if representation == "raw":
                assert np.array_equal(labels, native_labels)
        checkpoint = run / f"{model.lower()}.pt"
        artifacts.append({"model": model, "seed": seed, "checkpoint_sha256": digest(checkpoint),
                          "embedding_sha256": report["embedding_sha256"]})
    assert observed == expected
    for model in protocol["models"]:
        for representation in protocol["preprocessing"]:
            pairs = [row for row in summary["cross_seed_stability"]
                     if row["model"] == model and row["representation"] == representation]
            assert {(row["seed_left"], row["seed_right"]) for row in pairs} == set(combinations(protocol["seeds"], 2))
    result = {"status": "complete", "completed_at_utc": datetime.now(timezone.utc).isoformat(),
              "training_runs": len(observed), "representation_results": 36,
              "training_seed_pairs": 36, "source_files_checked": len(source),
              "analysis_sha256": analysis_digest, "validation": "passed",
              "checks": ["Declared seeds, training budgets, dimensions, sampler, and input hashes",
                         "Finite embedding arrays and immutable evaluation fingerprints",
                         "Native raw clustering agrees with common re-evaluation",
                         "All representation counts, noise fractions, and training-seed pairs",
                         "Frozen source and checkpoint SHA-256 fingerprints"],
              "artifacts": artifacts,
              "scope": "Completed fixed-budget comparison; no supervised or held-out prediction evaluation."}
    (ROOT / "completion.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "artifacts"}, indent=2))


if __name__ == "__main__":
    main()
