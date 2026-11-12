"""Reproducible analysis for the predeclared full-graph KGE experiment."""

import argparse
from itertools import combinations
from pathlib import Path
import time

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize
from threadpoolctl import threadpool_limits

from app.ml.assess_clustering import (
    cluster_jaccards, exhibition_matrix, fit, graph_agreement, matched_jaccard,
)
from app.ml.prepare_training_data import file_hash
from app.ml.utils import read_json, write_json

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parents[1] / "data"
ANALYSIS_SEED = 2026
REPRESENTATIONS = ("raw", "l2", "l2_pca10")


def transform(vectors, representation):
    if representation == "raw":
        return vectors, 1.0
    normalized = normalize(vectors, norm="l2").astype(np.float32)
    if representation == "l2":
        return normalized, 1.0
    pca = PCA(n_components=10, svd_solver="full")
    return pca.fit_transform(normalized).astype(np.float32), float(pca.explained_variance_ratio_.sum())


def silhouette(vectors, labels, sample):
    selected = sample[labels[sample] >= 0]
    groups = np.unique(labels[selected])
    value = float(silhouette_score(vectors[selected], labels[selected])) if 1 < len(groups) < len(selected) else None
    return value, len(selected)


def nearest_agreement(vectors, graph, k=10):
    neighbors = NearestNeighbors(n_neighbors=k + 1, metric="euclidean", algorithm="brute", n_jobs=1)
    indices = neighbors.fit(vectors).kneighbors(vectors, return_distance=False)
    indices = np.stack([row[row != index][:k] for index, row in enumerate(indices)])
    queries = np.repeat(np.arange(len(vectors)), k)
    values = graph[queries].multiply(graph[indices.ravel()]).sum(axis=1)
    return float((np.asarray(values).ravel() > 0).mean())


def top_exhibitions(labels, artists, edges, metadata):
    links = edges.copy()
    links["cluster"] = links["head"].map(dict(zip(artists.global_index, labels, strict=True)))
    links = links.loc[links.cluster >= 0]
    names = metadata.set_index("global_index").display_name.to_dict()
    sizes = pd.Series(labels[labels >= 0]).value_counts()
    descriptions = []
    for group, size in sizes.head(6).items():
        counts = links.loc[links.cluster.eq(group), "tail"].value_counts().head(4)
        descriptions.append({"cluster": int(group), "artist_count": int(size), "top_exhibitions": [
            {"title": names.get(int(index), str(index)), "artist_count": int(count)}
            for index, count in counts.items()
        ]})
    return descriptions


def analyze_run(run_dir, protocol, artists, metadata, edges, graph):
    training = read_json(run_dir / "training_final.json")
    expected_hashes = {key: protocol["prepared_input_sha256"][key] for key in (
        "entity_metadata.parquet", "relation_mapping.json", "triples.npy",
    )}
    if training["prepared_data_sha256"] != expected_hashes:
        raise ValueError(f"Prepared inputs differ: {run_dir}")
    run_artists = pd.read_csv(run_dir / "artist_metadata.csv", dtype={"entity": str, "id": str})
    if run_artists.entity.tolist() != artists.entity.tolist():
        raise ValueError(f"Artist ordering differs: {run_dir}")
    if not np.array_equal(run_artists.global_index, artists.global_index):
        raise ValueError("Global entity indices differ.")
    vectors = np.load(run_dir / "artist_embeddings.npy")
    if vectors.shape != (len(artists), 64) or not np.isfinite(vectors).all():
        raise ValueError("Unexpected or non-finite embedding array.")
    digest = file_hash(run_dir / "artist_embeddings.npy")
    analysis_digest = file_hash(Path(__file__))
    output = ROOT / "evaluation" / training["model"].lower() / f"seed_{training['random_seed']}"
    report_path = output / "evaluation.json"
    if report_path.exists():
        saved = read_json(report_path)
        if saved["embedding_sha256"] != digest:
            raise ValueError("Previously analyzed embedding file changed.")
        if saved.get("analysis_sha256") != analysis_digest:
            raise ValueError("Analysis code changed after a saved evaluation.")
        return saved
    output.mkdir(parents=True, exist_ok=True)
    generator = np.random.default_rng(ANALYSIS_SEED)
    sample = generator.choice(len(vectors), min(2000, len(vectors)), replace=False)
    subsets = [np.sort(generator.choice(len(vectors), int(.8 * len(vectors)), replace=False)) for _ in range(3)]
    norm_vectors = normalize(vectors, norm="l2").astype(np.float32)
    norm_range = np.linalg.norm(vectors, axis=1)
    report = {
        "model": training["model"], "seed": training["random_seed"], "run_dir": str(run_dir),
        "analysis_version": 1, "analysis_seed": ANALYSIS_SEED, "embedding_sha256": digest,
        "analysis_sha256": analysis_digest,
        "training_seconds": training["training_seconds"], "epochs": training["epochs"],
        "optimizer_updates": training["optimizer_updates"], "real_parameter_count": training["real_parameter_count"],
        "loss": training["loss"], "training_loss": training["training_loss"],
        "native_dimension": training["model_embedding_dimension"], "real_dimension": vectors.shape[1],
        "norm_min": float(norm_range.min()), "norm_mean": float(norm_range.mean()), "norm_max": float(norm_range.max()),
        "representations": {}, "supervised_evaluation": None,
        "limitations": "No reference artist labels or held-out predictive evaluation. Exhibition agreement uses training facts. Fixed embeddings during subsampling."
    }
    for representation in REPRESENTATIONS:
        print(f"Evaluating {training['model']} seed {training['random_seed']}: {representation}", flush=True)
        transformed, retained = transform(vectors, representation)
        started = time.perf_counter()
        model = fit(transformed, 50, 5, "eom")
        labels = model.labels_
        np.save(output / f"labels_{representation}.npy", labels)
        groups, counts = np.unique(labels[labels >= 0], return_counts=True)
        stability = []
        per_cluster = {int(group): [] for group in groups}
        if len(groups):
            for subset in subsets:
                repeated, _ = transform(vectors[subset], representation)
                repeated_labels = fit(repeated, 50, 5, "eom").labels_
                found, _, scores = cluster_jaccards(labels[subset], repeated_labels)
                matching = dict(zip(found.tolist(), scores.tolist(), strict=True))
                for group in per_cluster:
                    per_cluster[group].append(matching.get(group, 0.0))
                stability.append(matched_jaccard(labels[subset], repeated_labels))
        native_silhouette, selected_count = silhouette(vectors, labels, sample)
        normalized_silhouette, _ = silhouette(norm_vectors, labels, sample)
        row = {
            "model": training["model"], "seed": training["random_seed"], "representation": representation,
            "dimension": transformed.shape[1], "retained_variance": retained,
            "cluster_count": len(groups), "assigned_count": int(np.sum(labels >= 0)),
            "noise_fraction": float(np.mean(labels < 0)),
            "largest_cluster_fraction": float(counts.max() / len(labels)) if len(counts) else None,
            "largest_assigned_fraction": float(counts.max() / counts.sum()) if len(counts) else None,
            "silhouette_native": native_silhouette, "silhouette_l2": normalized_silhouette,
            "silhouette_assigned_sample_count": selected_count,
            "relative_validity_approx": float(model.relative_validity_) if len(groups) else None,
            "mean_cluster_persistence": float(np.mean(model.cluster_persistence_)) if len(groups) else None,
            "subsample_jaccard": stability,
            "subsample_jaccard_mean": float(np.mean(stability)) if stability else None,
            "per_cluster_jaccard_mean": {group: float(np.mean(values)) for group, values in per_cluster.items()},
            "nearest10_shared_exhibition": nearest_agreement(transformed, graph),
            **graph_agreement(labels, graph, ANALYSIS_SEED),
            "cluster_sizes": dict(zip(groups.tolist(), counts.tolist(), strict=True)),
            "profiles": top_exhibitions(labels, artists, edges, metadata),
            "analysis_seconds": time.perf_counter() - started,
        }
        report["representations"][representation] = row
        print({key: row[key] for key in ("model", "seed", "representation", "cluster_count", "noise_fraction", "subsample_jaccard_mean", "nearest10_shared_exhibition")}, flush=True)
    write_json(report_path, report)
    return report


def aggregate(reports):
    rows = [row for report in reports for row in report["representations"].values()]
    if not rows:
        return
    table = pd.DataFrame([{key: value for key, value in row.items()
                           if key not in {"profiles", "cluster_sizes", "subsample_jaccard", "per_cluster_jaccard_mean"}}
                          for row in rows])
    table.to_csv(ROOT / "evaluation_runs.csv", index=False)
    metrics = ("cluster_count", "noise_fraction", "largest_cluster_fraction", "largest_assigned_fraction",
               "silhouette_l2", "silhouette_native", "subsample_jaccard_mean", "nearest10_shared_exhibition",
               "within_cluster_shared_exhibition", "random_assigned_shared_exhibition", "mean_cluster_persistence")
    summaries = []
    cross_seed_rows = []
    for (model, representation), group in table.groupby(["model", "representation"], sort=False):
        summary = {"model": model, "representation": representation, "completed_seeds": len(group)}
        for metric in metrics:
            summary[f"{metric}_mean"] = group[metric].mean()
            summary[f"{metric}_std"] = group[metric].std()
        pair_scores, aris = [], []
        for left, right in combinations(sorted(group.seed.tolist()), 2):
            left_labels = np.load(ROOT / "evaluation" / model.lower() / f"seed_{left}" / f"labels_{representation}.npy")
            right_labels = np.load(ROOT / "evaluation" / model.lower() / f"seed_{right}" / f"labels_{representation}.npy")
            # Losing all clusters in one seed is a failed recovery, not a missing observation.
            if np.any(left_labels >= 0) or np.any(right_labels >= 0):
                forward = matched_jaccard(left_labels, right_labels)
                backward = matched_jaccard(right_labels, left_labels)
                mean = (forward + backward) / 2
                ari = float(adjusted_rand_score(left_labels, right_labels))
                pair_scores.append(mean)
                aris.append(ari)
            else:
                forward = backward = mean = ari = None
            cross_seed_rows.append({"model": model, "representation": representation,
                                   "seed_left": left, "seed_right": right, "jaccard_left_to_right": forward,
                                   "jaccard_right_to_left": backward, "bidirectional_jaccard": mean,
                                   "ari_including_noise": ari})
        summary["cross_seed_jaccard_mean"] = float(np.mean(pair_scores)) if pair_scores else None
        summary["cross_seed_valid_pairs"] = len(pair_scores)
        summary["cross_seed_ari_including_noise_mean"] = float(np.mean(aris)) if aris else None
        summaries.append(summary)
    pd.DataFrame(summaries).to_csv(ROOT / "evaluation_summary.csv", index=False)
    pd.DataFrame(cross_seed_rows).to_csv(ROOT / "cross_seed_stability.csv", index=False)
    write_json(ROOT / "evaluation_summary.json", {
        "status": "complete" if len(reports) == 12 else "partial", "completed_runs": len(reports),
        "expected_runs": 12, "summary": summaries, "cross_seed_stability": cross_seed_rows,
        "scope": "Fixed training-budget comparison, no supervised reference groups, no automatic winner selection.",
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--watch", action="store_true")
    arguments = parser.parse_args()
    protocol = read_json(ROOT / "protocol.json")
    metadata = pd.read_parquet(DATA / "entity_metadata.parquet").sort_values("global_index")
    artists = metadata.loc[metadata.type.eq("Artist")].reset_index(drop=True)
    edges = pd.read_parquet(DATA / "indexed_edges.parquet", filters=[("relation", "==", "EXHIBITED_AT")])
    graph = exhibition_matrix(artists, edges)
    generator = np.random.default_rng(ANALYSIS_SEED)
    queries = np.repeat(np.arange(len(artists)), 10)
    partners = (queries + generator.integers(1, len(artists), size=len(queries))) % len(artists)
    shared = graph[queries].multiply(graph[partners]).sum(axis=1)
    write_json(ROOT / "data_context.json", {
        "artist_count": len(artists), "exhibition_count": graph.shape[1],
        "artist_exhibition_links": len(edges),
        "artists_with_exhibition_links": int(np.sum(np.diff(graph.indptr) > 0)),
        "random_other_artist_shared_exhibition": float((np.asarray(shared).ravel() > 0).mean()),
        "random_pair_count": len(queries), "random_seed": ANALYSIS_SEED,
        "scope": "Descriptive training-graph context, not held-out evaluation.",
    })
    for name, expected in protocol["prepared_input_sha256"].items():
        if file_hash(DATA / name) != expected:
            raise ValueError(f"Input artifact changed: {name}")
    reports = {}
    with threadpool_limits(limits=2):
        while True:
            for path in sorted(ROOT.glob("*/*/seed_*/training_final.json")):
                run_dir = path.parent
                if str(run_dir) not in reports and (run_dir / "hdbscan_summary.json").exists():
                    reports[str(run_dir)] = analyze_run(run_dir, protocol, artists, metadata, edges, graph)
                    aggregate(list(reports.values()))
            if len(reports) == 12 or not arguments.watch:
                break
            time.sleep(10)
    print(f"Analysis available for {len(reports)}/12 full-data runs.", flush=True)


if __name__ == "__main__":
    main()
