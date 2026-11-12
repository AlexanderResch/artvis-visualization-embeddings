import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from itertools import combinations
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import numpy as np
import pandas as pd
from sklearn.metrics import adjusted_rand_score

from app.ml.assess_clustering import exhibition_matrix, matched_jaccard
from app.ml.config import DATA_ROOT, MODEL_ROOT
from app.ml.group_evaluation import evaluate_groups
from app.ml.prepare_training_data import file_hash
from app.ml.utils import read_json, write_json


def stable_partitions(reports):
    rows = []
    scores = {report["seed"]: [] for report in reports}
    for left, right in combinations(reports, 2):
        a, b = left["labels"], right["labels"]
        if np.any(a >= 0) or np.any(b >= 0):
            jaccard = (matched_jaccard(a, b) + matched_jaccard(b, a)) / 2
            ari = float(adjusted_rand_score(a, b))
            scores[left["seed"]].append(jaccard)
            scores[right["seed"]].append(jaccard)
        else:
            jaccard = ari = None
        rows.append({"model": left["model"], "seed_left": left["seed"], "seed_right": right["seed"],
                     "jaccard": jaccard, "ari_including_noise": ari})
    representative = max(scores, key=lambda seed: (np.mean(scores[seed]) if scores[seed] else -1, -seed))
    return rows, representative


def publish_model(root, model, selected, representative, reports, input_dir):
    input_relative = input_dir.resolve().relative_to(DATA_ROOT.resolve()).as_posix()
    output = MODEL_ROOT / model.lower()
    marker = output / "selection_source.json"
    run = Path(representative["run_dir"])
    source_hash = file_hash(run / "artist_embeddings.npy")
    if output.exists() and any(output.iterdir()) and not marker.exists():
        raise FileExistsError(f"Unrecognized model output directory: {output}")
    if marker.exists() and read_json(marker)["embedding_sha256"] != source_hash:
        raise ValueError("Published model belongs to another selected run.")
    output.mkdir(parents=True, exist_ok=True)
    write_json(marker, {"experiment": str(root), "run_dir": str(run), "model": model,
                       "seed": representative["seed"], "embedding_sha256": source_hash,
                       "representation": selected["representation"], "selection": selected})
    for name in (f"{model.lower()}.pt", "artist_embeddings.npy", "artist_metadata.parquet",
                 "training_final.json", "embedding_summary.json"):
        shutil.copy2(run / name, output / name)
    environment = {**os.environ, "HDBSCAN_MIN_CLUSTER_SIZE": "50", "HDBSCAN_MIN_SAMPLES": "5",
                   "HDBSCAN_CLUSTER_SELECTION_METHOD": "eom", "HDBSCAN_PCA_COMPONENTS": "10",
                   "HDBSCAN_USE_PCA": str(selected["representation"] == "l2_pca10").lower(),
                   "HDBSCAN_NORMALIZE": str(selected["representation"] != "raw").lower(),
                   "TORCH_NUM_THREADS": "2", "NUMBA_NUM_THREADS": "2", "OMP_NUM_THREADS": "2",
                   "MKL_NUM_THREADS": "2", "OPENBLAS_NUM_THREADS": "2"}
    command = [sys.executable, "-u", "-m", "app.ml.run_pipeline", "--model", model,
               "--input-dir", str(input_dir), "--data-dir", str(output), "--seed", str(representative["seed"]),
               "--steps", "cluster", "project", "materialize", "profile"]
    print(f"Preparing application data for {model}, seed {representative['seed']}.", flush=True)
    with (output / "materialization.log").open("w", encoding="utf-8") as log:
        subprocess.run(command, env=environment, stdout=log, stderr=subprocess.STDOUT, check=True)
    clusters = pd.read_parquet(output / "artist_clusters.parquet")
    if not np.array_equal(clusters.cluster.to_numpy(), representative["labels"]):
        raise ValueError(f"Published clustering differs from evaluated labels: {model}")
    vectors = np.load(output / "artist_embeddings.npy")
    for dimension in (2, 3):
        frame = pd.read_parquet(output / f"artist_map_{dimension}d.parquet")
        if len(frame) != len(vectors) or not np.isfinite(frame[list("xyz"[:dimension])]).all().all():
            raise ValueError("Invalid map coordinates.")
        if not frame.entity.equals(clusters.entity) or not np.array_equal(frame.cluster, clusters.cluster):
            raise ValueError("Map, clusters, and artist ordering differ.")
    write_json(output / "group_evaluation.json", {
        "model": model, "seed": representative["seed"], "validation": representative["validation"],
        "test": representative["test"], "reference": read_json(input_dir / "group_reference_summary.json"),
        "note": "Held-out membership labels were evaluated after configuration selection. Training excludes MEMBER_OF. Overlapping groups use pairwise precision, recall, and F1; ARI/AMI use the singly labeled subset with noise as singletons.",
    })
    summary = read_json(output / "hdbscan_summary.json")
    summary["parameter_selection"] = "Chosen on validation artist memberships; see selection_source.json. Held-out test labels were not used to choose the configuration or displayed seed."
    write_json(output / "hdbscan_summary.json", summary)
    print(f"Verified application maps and clusters for {model}.", flush=True)
    return {"input_directory": input_relative, "seed": representative["seed"],
            "representation": selected["representation"]}


def metric_row(report):
    keys = ("model", "seed", "epochs", "representation", "cluster_count", "assigned_count", "noise_fraction",
            "largest_cluster_fraction", "silhouette_l2", "subsample_jaccard_mean", "nearest10_shared_exhibition",
            "within_cluster_shared_exhibition", "random_assigned_shared_exhibition", "training_seconds")
    row = {key: report.get(key) for key in keys}
    row["configuration"] = report["config"]["name"]
    row["learning_rate"] = report["config"]["learning_rate"]
    row["regularizer_weight"] = report["config"]["regularizer_weight"]
    for split in ("validation", "test"):
        row.update({f"{split}_{key}": value for key, value in report[split].items()})
    return row


def markdown_table(headers, rows):
    return "\n".join(["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |",
                       *("| " + " | ".join(map(str, row)) + " |" for row in rows)])


def application_catalog(experiment, artifacts, summaries, runs):
    ranked = sorted(summaries, key=lambda row: -row["validation_pair_f1_mean"])
    models = {}
    metrics = ("validation_pair_f1_mean", "test_pair_f1_mean", "noise_fraction_mean", "cross_seed_jaccard_mean")
    for rank, summary in enumerate(ranked, start=1):
        key = summary["model"].lower()
        models[key] = {
            **artifacts[key], "rank": rank,
            "evaluation": {
                **{metric: summary[metric] for metric in metrics},
                "completed_seeds": summary["completed_seeds"],
                "clustered_seeds": int(runs.loc[runs.model.eq(summary["model"]), "cluster_count"].gt(0).sum()),
            },
        }
    return {"default": next(iter(models)), "experiment": experiment,
            "ranking_metric": "validation_pair_f1_mean", "models": models}


def report_markdown(root, protocol, summary, recommendation, selections, representative_seeds):
    rows, settings, group_rows = [], [], []
    for model in protocol["models"]:
        row = next(row for row in summary if row["model"] == model)
        selected = selections[model]
        value = lambda name: "—" if row.get(name) is None else f"{row[name]:.3f}"
        rows.append([model, value("cluster_count_mean"), f"{100 * row['noise_fraction_mean']:.1f}%",
                     value("subsample_jaccard_mean_mean"), value("cross_seed_jaccard_mean"),
                     value("test_pair_precision_mean"), value("test_pair_recall_mean"), value("test_pair_f1_mean")])
        settings.append([model, selected["config"]["learning_rate"], selected["config"]["regularizer_weight"] if selected["config"]["regularizer_weight"] is not None else "native default",
                         selected["epochs"], selected["representation"], representative_seeds[model]])
        group_rows.append([model, value("test_reference_assigned_fraction_mean"),
                           value("test_ari_single_label_noise_singletons_mean"), value("test_ami_single_label_noise_singletons_mean")])
    context = protocol["label_split"]
    content = [
        "# Knowledge graph embedding comparison with Neo4j group references", "",
        "Status: completed. Four standard PyKEEN models, two predefined training configurations per model, checkpoints after two and four epochs, three representations, and five confirmation seeds for each selected configuration.", "",
        "## Data and evaluation design", "",
        f"The same prepared graph contains {protocol['training_artist_count']:,} embedded artists. CO_EXHIBITED is retained. All 1,896 MEMBER_OF relationships are excluded from training; their Group nodes have no remaining structural edges and are not embedded.", "",
        f"Neo4j supplies {context['known_artists']:,} labeled artists in {context['groups_in_database']} groups. {context['artists_with_multiple_groups']} artists have multiple recorded groups. Twenty-one labeled artists have no remaining structural relationships and therefore receive no embedding; they stay in reference evaluation as unassigned artists.", "",
        "A deterministic artist-level split assigns 598 artists to validation and 598 to test. All memberships of an artist remain in the same split. Validation labels choose configurations. Test agreement is computed only after every configuration is frozen and all confirmation trainings finish. This is a transductive graph experiment with held-out membership labels, not held-out link prediction.", "",
        "## Training and selection", "",
        "Each model compares its native PyKEEN settings at learning rate 0.001 with an adjusted configuration at 0.01. The adjusted DistMult and ComplEx runs use regularizer weight 0.001, retaining their native regularizer type and remaining regularizer settings. TransE and RotatE retain their native regularization. The adjusted setting changes two parameters together for regularized models; this experiment does not isolate their individual effects.", "",
        "All models export 64 real features (64 real dimensions or 32 complex dimensions with both components retained). Training uses CPU, two Torch threads per worker, Adam with native fused execution, batches of 2,048, and one filtered pseudo-typed negative per positive. Four workers can run concurrently. Wall time depends on shared machine load.", "",
        "The tuning seed is 41. Each of two trainings supplies two- and four-epoch checkpoints. Raw, L2, and L2 followed by ten-component PCA are evaluated at fixed HDBSCAN settings: minimum cluster size 50, minimum samples 5, Euclidean distance, EOM, exact MST. The highest validation pair-F1 wins; ties use subset Jaccard, lower noise, and fewer epochs. The chosen configuration is confirmed with seeds 41–45. The tuning seed is reused as one of five confirmation seeds; four additional starts are independent of that initialization. This is a bounded search, not exhaustive optimization or a guarantee of convergence.", "",
        markdown_table(["Model", "Learning rate", "Regularizer weight override", "Epochs", "Representation", "Displayed seed"], settings), "",
        "## Confirmation results", "",
        "Values are means over five starts. Sample standard deviations and all individual measurements are in the Parquet tables. Undefined cluster-specific scores remain null; no-cluster cases still contribute their full noise fraction and zero pair-F1.", "",
        markdown_table(["Model", "Clusters", "Noise", "Subset Jaccard", "Seed Jaccard", "Test pair precision", "Test pair recall", "Test pair F1"], rows), "",
        markdown_table(["Model", "Test labeled-artist coverage", "ARI: single-label subset", "AMI: single-label subset"], group_rows), "",
        "## Metric definitions and limits", "",
        "- Reference pair truth is positive when two labeled artists share at least one recorded Group. A predicted positive requires the same non-noise cluster. All unordered pairs within the respective label split are evaluated exactly. Unlabeled artists do not become negative reference examples. Noise and missing embeddings do not form a shared predicted group. Precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2TP/(2TP+FP+FN); zero-denominator results are set to zero.",
        "- Group memberships overlap, so a disjoint clustering cannot necessarily recover every positive pair without introducing false positives. ARI and AMI are consequently secondary scores on artists with exactly one known group. Each unassigned artist is treated as a distinct singleton for these scores. Counts and coverage accompany the metrics.",
        "- Subset stability averages size-weighted best cluster Jaccard over three fixed 80% artist subsets, refitting preprocessing and clustering with trained embeddings fixed. Seed stability averages best matching in both directions for each of the ten seed pairs. Noise is excluded as a group. Losing all groups in one partition counts as zero recovery; two all-noise partitions have undefined cluster stability.",
        "- Silhouette uses the assigned members of a common 2,000-artist sample, evaluated in full L2-normalized feature space. Assigned populations and learned geometries differ, so this is an internal diagnostic. PCA is full SVD without whitening. UMAP is used only for the display.",
        "- NN10 shared-exhibition agreement uses the selected clustering representation. Application artist similarity uses the full normalized embedding features. The NN10 check and 20,000 sampled within-cluster pairs describe EXHIBITED_AT facts in the training graph. Random within-population pairs provide context. These checks do not establish independent prediction accuracy or historical correctness.",
        "- Recorded memberships can be incomplete and need not define the only meaningful exhibition-network grouping. A low reference score can reflect a different grouping objective as well as poor representations. Cluster coverage, stability, reference agreement, and graph interpretation should be read together.", "",
        "## Application datasets", "",
        "Each dropdown option selects one fixed model dataset: embeddings, clusters, 2D/3D maps, profiles, and evaluation metadata. Its displayed seed maximizes mean matched Jaccard against the other confirmation starts, with the smallest seed breaking a tie. No test-label score selects the displayed run. Cluster IDs and UMAP coordinates are local to each model and do not identify equivalent groups across models. Models are listed by mean validation pair-F1, with the highest-ranked model as the default.", "",
        "All new tabular artifacts use Parquet. Small configuration/evaluation documents use JSON; NumPy arrays, PyTorch checkpoints, and fitted sklearn/HDBSCAN models retain their native formats. Existing backups and the earlier fixed-budget comparison retain their original files.", "",
        "## Selection interpretation", "",
        f"The model with the highest mean validation pair-F1 among these frozen configurations is {recommendation}. This recommendation is recorded before held-out test outcomes are calculated. The test table provides complementary post-selection evidence; no further tuning is performed against those outcomes.", "",
        "## Reproducibility", "",
        "protocol.json records the search, label split, input hashes, and selection rule. publication_protocol.json records final model/running-seed policies. Frozen source is in source/. tuning_results.parquet, confirmation_runs.parquet, model_summary.parquet, and cross_seed_stability.parquet retain the numeric evidence. evaluation/<model>/seed_<seed>/evaluation_final.json includes source/checkpoint/embedding fingerprints, validation and test scores. Training logs and binary artifacts remain in the ignored experiment directory. No commit or push was performed.", "",
        "Technical definitions: [PyKEEN model tuning](https://pykeen.readthedocs.io/en/stable/tutorial/running_hpo.html), [scikit-learn clustering evaluation](https://scikit-learn.org/stable/modules/clustering.html#clustering-performance-evaluation), [HDBSCAN](https://hdbscan.readthedocs.io/en/latest/api.html).", "",
    ]
    (root / "report.md").write_text("\n".join(content), encoding="utf-8")


def finalize(root):
    protocol = read_json(root / "protocol.json")
    input_dir = Path(protocol["input_dir"])
    for name, digest in protocol["input_sha256"].items():
        if file_hash(input_dir / name) != digest:
            raise ValueError(f"Frozen input changed: {name}")
    selections, reports_by_model, cross_rows, representative_seeds = {}, {}, [], {}
    hashes = {}
    for model in protocol["models"]:
        directory = root / model.lower()
        if not (directory / "worker_complete.json").exists():
            raise ValueError(f"Confirmation runs are incomplete: {model}")
        selections[model] = read_json(directory / "selection.json")
        hashes[model] = file_hash(directory / "selection.json")
        reports = []
        for seed in protocol["confirmation_seeds"]:
            evaluated = directory / "evaluation" / f"seed_{seed}"
            report = read_json(evaluated / "evaluation.json")
            report["labels"] = np.load(evaluated / "labels.npy")
            reports.append(report)
        cross, representative = stable_partitions(reports)
        cross_rows.extend(cross)
        representative_seeds[model] = representative
        reports_by_model[model] = reports
    recommendation = max(protocol["models"], key=lambda model: np.mean([
        report["validation"]["pair_f1"] for report in reports_by_model[model]
    ]))
    selection_record = {
        "selection_sha256": hashes, "representative_seeds": representative_seeds,
        "recommended_model_from_validation": recommendation,
        "rule": "Highest mean validation pair-F1; representative seeds use cross-seed Jaccard only.",
    }
    selection_path = root / "selection_manifest.json"
    if selection_path.exists():
        existing = read_json(selection_path)
        if any(existing[key] != value for key, value in selection_record.items()):
            raise ValueError("The configuration freeze changed after test evaluation.")
    else:
        write_json(selection_path, {"frozen_before_test_at_utc": datetime.now(timezone.utc).isoformat(), **selection_record})
    metadata = pd.read_parquet(input_dir / "entity_metadata.parquet")
    artists = metadata.loc[metadata.type.eq("Artist")].reset_index(drop=True)
    edges = pd.read_parquet(input_dir / "indexed_edges.parquet", filters=[("relation", "==", "EXHIBITED_AT")])
    graph = exhibition_matrix(artists, edges)
    generator = np.random.default_rng(2026)
    queries = np.repeat(np.arange(len(artists)), 10)
    partners = (queries + generator.integers(1, len(artists), size=len(queries))) % len(artists)
    shared = graph[queries].multiply(graph[partners]).sum(axis=1)
    write_json(root / "data_context.json", {"artist_count": len(artists), "exhibition_count": graph.shape[1],
        "random_pair_count": len(queries), "random_other_artist_shared_exhibition": float((np.asarray(shared).ravel() > 0).mean()),
        "analysis_seed": 2026, "scope": "Descriptive training-graph context."})
    reference = pd.read_parquet(input_dir / "group_reference.parquet")
    test = reference.loc[reference.split.eq("test")]
    metric_rows = []
    for model, reports in reports_by_model.items():
        for report in reports:
            run = Path(report["run_dir"])
            training = read_json(run / "training_final.json")
            if training["model"] != model or training["random_seed"] != report["seed"]:
                raise ValueError("Training and evaluation identifiers differ.")
            if not training["excluded_group_memberships"]:
                raise ValueError("Reference label leakage.")
            for name, digest in training["prepared_data_sha256"].items():
                if digest != protocol["input_sha256"][name]:
                    raise ValueError("Training used another input graph.")
            artists = pd.read_parquet(run / "artist_metadata.parquet")
            report["test"] = evaluate_groups(artists, report["labels"], test)
            report["training_seconds"] = training["training_seconds"]
            report["embedding_sha256"] = file_hash(run / "artist_embeddings.npy")
            report["checkpoint_sha256"] = file_hash(run / f"{model.lower()}.pt")
            metric_rows.append(metric_row(report))
            output = root / "evaluation" / model.lower() / f"seed_{report['seed']}"
            output.mkdir(parents=True, exist_ok=True)
            write_json(output / "evaluation_final.json", {key: value for key, value in report.items() if key != "labels"})
    table = pd.DataFrame(metric_rows)
    table.to_parquet(root / "confirmation_runs.parquet", index=False, compression="zstd")
    pd.concat([pd.read_parquet(root / model.lower() / "tuning_results.parquet") for model in protocol["models"]]).to_parquet(
        root / "tuning_results.parquet", index=False, compression="zstd")
    pd.DataFrame(cross_rows).to_parquet(root / "cross_seed_stability.parquet", index=False, compression="zstd")
    summaries = []
    for model, group in table.groupby("model", sort=False):
        summary = {"model": model, "completed_seeds": len(group)}
        for metric in group.select_dtypes(include=np.number).columns:
            if metric == "seed":
                continue
            summary[f"{metric}_mean"] = group[metric].mean()
            summary[f"{metric}_std"] = group[metric].std()
        scores = [row["jaccard"] for row in cross_rows if row["model"] == model and row["jaccard"] is not None]
        summary["cross_seed_jaccard_mean"] = float(np.mean(scores)) if scores else None
        summary["representative_seed"] = representative_seeds[model]
        summaries.append(summary)
    summaries = [{key: (None if isinstance(value, (float, np.floating)) and not np.isfinite(value) else value)
                  for key, value in row.items()} for row in summaries]
    pd.DataFrame(summaries).to_parquet(root / "model_summary.parquet", index=False, compression="zstd")
    write_json(root / "model_summary.json", {"models": summaries, "validation_recommendation": recommendation})
    report_markdown(root, protocol, summaries, recommendation, selections, representative_seeds)
    def publish(model):
        reports = reports_by_model[model]
        representative = next(report for report in reports if report["seed"] == representative_seeds[model])
        return model.lower(), publish_model(root, model, selections[model], representative, reports, input_dir)
    with ThreadPoolExecutor(max_workers=2) as pool:
        models = dict(pool.map(publish, protocol["models"]))
    model_root = MODEL_ROOT
    write_json(model_root / "manifest.pending.json", application_catalog(root.name, models, summaries, table))
    (model_root / "manifest.pending.json").replace(model_root / "manifest.json")
    write_json(root / "completion.json", {"status": "complete", "completed_at_utc": datetime.now(timezone.utc).isoformat(),
               "confirmation_runs": len(metric_rows), "tuning_candidates": len(pd.read_parquet(root / "tuning_results.parquet")),
               "published_models": list(models), "validation_recommendation": recommendation,
               "reference_test_evaluated_after_selection": True})
    print(f"Completed reference evaluation and published all four models. Validation recommendation: {recommendation}.", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--watch", action="store_true")
    args = parser.parse_args()
    protocol = read_json(args.root / "protocol.json")
    while not all((args.root / model.lower() / "worker_complete.json").exists() for model in protocol["models"]):
        if not args.watch:
            raise RuntimeError("Model workers are not complete.")
        time.sleep(10)
    finalize(args.root)


if __name__ == "__main__":
    main()
