"""Bounded PCA/HDBSCAN diagnostics with explicit coverage and stability measures.

This optional analysis does not change application artifacts or select a winner
automatically. Graph agreement is in-sample and is not prediction accuracy.
"""

import argparse
from pathlib import Path

import hdbscan
import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from threadpoolctl import threadpool_limits

from app.ml.config import ARTIST_METADATA_PATH, INDEXED_EDGES_PATH, RANDOM_SEED
from app.ml.prepare_training_data import file_hash
from app.ml.utils import write_json


def cluster_jaccards(reference, repeated):
    """Best Jaccard match for each reference cluster, excluding noise."""
    groups, weights = np.unique(reference[reference >= 0], return_counts=True)
    other, other_sizes = np.unique(repeated[repeated >= 0], return_counts=True)
    if not len(groups):
        return groups, weights, np.array([], dtype=float)
    if not len(other):
        return groups, weights, np.zeros(len(groups))
    common = (reference >= 0) & (repeated >= 0)
    left = np.searchsorted(groups, reference[common])
    right = np.searchsorted(other, repeated[common])
    intersection = np.bincount(left * len(other) + right, minlength=len(groups) * len(other))
    intersection = intersection.reshape(len(groups), len(other))
    union = weights[:, None] + other_sizes[None, :] - intersection
    return groups, weights, (intersection / union).max(axis=1)


def matched_jaccard(reference, repeated):
    """Size-weighted best Jaccard match; noise does not count as a cluster."""
    groups, weights, scores = cluster_jaccards(reference, repeated)
    return float(np.average(scores, weights=weights)) if len(groups) else 0.0


def fit(data, size, samples, method="eom"):
    return hdbscan.HDBSCAN(
        min_cluster_size=size, min_samples=samples, metric="euclidean",
        cluster_selection_method=method, approx_min_span_tree=False,
        core_dist_n_jobs=1, gen_min_span_tree=True,
    ).fit(data)


def exhibition_matrix(artists, edges):
    links = edges.loc[edges.relation.eq("EXHIBITED_AT")].copy()
    artist_ids = dict(zip(artists.global_index, np.arange(len(artists)), strict=True))
    links["artist_index"] = links["head"].map(artist_ids)
    links = links.dropna(subset=["artist_index"])
    exhibitions = {value: index for index, value in enumerate(sorted(links["tail"].unique()))}
    return sparse.csr_matrix((np.ones(len(links)), (
        links.artist_index.astype(int), links["tail"].map(exhibitions),
    )), shape=(len(artists), len(exhibitions)))


def graph_agreement(labels, matrix, seed):
    assigned = np.flatnonzero(labels >= 0)
    if len(assigned) < 2:
        return {"within_cluster_shared_exhibition": None, "random_assigned_shared_exhibition": None}
    generator = np.random.default_rng(seed)
    queries = generator.choice(assigned, size=20000, replace=True)
    partners = np.empty(len(queries), dtype=int)
    for label in np.unique(labels[assigned]):
        positions = np.flatnonzero(labels[queries] == label)
        members = np.flatnonzero(labels == label)
        # Rotate by a random nonzero offset to exclude the query itself.
        offsets = generator.integers(1, len(members), len(positions))
        partners[positions] = members[(np.searchsorted(members, queries[positions]) + offsets) % len(members)]
    random_offsets = generator.integers(1, len(assigned), len(queries))
    random_partners = assigned[(np.searchsorted(assigned, queries) + random_offsets) % len(assigned)]
    def rate(neighbors):
        return float((np.asarray(matrix[queries].multiply(matrix[neighbors]).sum(axis=1)).ravel() > 0).mean())
    return {"within_cluster_shared_exhibition": rate(partners),
            "random_assigned_shared_exhibition": rate(random_partners)}


def assess(embeddings, artists, edges, method="eom"):
    if len(embeddings) != len(artists):
        raise ValueError("Embedding and metadata populations differ.")
    generator = np.random.default_rng(RANDOM_SEED)
    sample = generator.choice(len(embeddings), min(2000, len(embeddings)), replace=False)
    subsets = [np.sort(generator.choice(len(embeddings), int(.8 * len(embeddings)), replace=False))
               for _ in range(3)]
    graph = exhibition_matrix(artists, edges)
    results = []
    # Declare the finite comparison before reading any candidate labels.
    for dimension in (5, 10, 15):
        if dimension >= min(embeddings.shape):
            continue
        pca = PCA(n_components=dimension, svd_solver="full")
        data = pca.fit_transform(embeddings).astype(np.float32)
        subset_data = [PCA(n_components=dimension, svd_solver="full")
                       .fit_transform(embeddings[subset]).astype(np.float32) for subset in subsets]
        for size in (30, 50):
            for samples in (3, 5, 10):
                model = fit(data, size, samples, method)
                labels = model.labels_
                counts = np.unique(labels[labels >= 0], return_counts=True)[1]
                assigned_sample = sample[labels[sample] >= 0]
                valid = 1 < len(np.unique(labels[assigned_sample])) < len(assigned_sample)
                stability = []
                for subset, transformed in zip(subsets, subset_data, strict=True):
                    repeated = fit(transformed, size, samples, method).labels_
                    stability.append(matched_jaccard(labels[subset], repeated))
                row = {
                    "pca_components": dimension, "retained_variance": float(pca.explained_variance_ratio_.sum()),
                    "min_cluster_size": size, "min_samples": samples,
                    "cluster_selection_method": method,
                    "cluster_count": len(counts), "assigned_fraction": float(np.mean(labels >= 0)),
                    "largest_cluster_fraction": float(counts.max() / len(labels)) if len(counts) else 0.0,
                    "silhouette_original": float(silhouette_score(embeddings[assigned_sample], labels[assigned_sample])) if valid else None,
                    "silhouette_pca": float(silhouette_score(data[assigned_sample], labels[assigned_sample])) if valid else None,
                    "relative_validity": float(model.relative_validity_) if len(counts) else None,
                    "matched_jaccard": stability, "mean_matched_jaccard": float(np.mean(stability)),
                    **graph_agreement(labels, graph, RANDOM_SEED),
                }
                results.append(row)
                print(row, flush=True)
    return {"random_seed": RANDOM_SEED, "artist_count": len(artists), "graph_pair_samples": 20000,
            "candidates": results,
            "limitations": [
                "Exploratory finite comparison; no automatic selection by a composite score.",
                "Three 80% subsamples refit PCA and HDBSCAN. Noise is excluded from Jaccard cluster matching.",
                "Graph agreement uses training facts and is not independent predictive evaluation.",
                "Coverage, group sizes, stability, and graph descriptions must be assessed together.",
            ]}


def validate(embeddings, artists, edges, dimension, size, samples, method, repetitions):
    def transform(vectors):
        return PCA(n_components=dimension, svd_solver="full").fit_transform(vectors).astype(np.float32) if dimension else vectors
    labels = fit(transform(embeddings), size, samples, method).labels_
    groups, counts = np.unique(labels[labels >= 0], return_counts=True)
    generator = np.random.default_rng(RANDOM_SEED)
    stability, per_cluster = [], {int(group): [] for group in groups}
    for _ in range(repetitions):
        subset = np.sort(generator.choice(len(embeddings), int(.8 * len(embeddings)), replace=False))
        repeated = fit(transform(embeddings[subset]), size, samples, method).labels_
        found, _, scores = cluster_jaccards(labels[subset], repeated)
        values = dict(zip(found.tolist(), scores.tolist(), strict=True))
        for group in per_cluster:
            per_cluster[group].append(values.get(group, 0.0))
        stability.append(matched_jaccard(labels[subset], repeated))
    result = {
        "analysis_seed": RANDOM_SEED, "artist_count": len(artists),
        "pca_components": dimension or None, "min_cluster_size": size,
        "min_samples": samples, "cluster_selection_method": method,
        "cluster_count": len(groups), "cluster_sizes": dict(zip(groups.tolist(), counts.tolist(), strict=True)),
        "assigned_fraction": float(np.mean(labels >= 0)),
        "subsample_fraction": .8, "repetitions": repetitions,
        "matched_jaccard": stability, "mean_matched_jaccard": float(np.mean(stability)),
        "per_cluster_mean_jaccard": {group: float(np.mean(values)) for group, values in per_cluster.items()},
        **graph_agreement(labels, exhibition_matrix(artists, edges), RANDOM_SEED),
        "limitations": "Stability under artist subsampling, with fixed embeddings. Graph agreement uses training facts; neither measure establishes historical validity.",
    }
    return result, labels


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("embeddings", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--method", choices=("eom", "leaf"), default="eom")
    parser.add_argument("--validate", action="store_true", help="Validate one frozen configuration instead of the grid.")
    parser.add_argument("--components", type=int, default=0, help="PCA components; zero uses the full embeddings.")
    parser.add_argument("--min-cluster-size", type=int, default=50)
    parser.add_argument("--min-samples", type=int, default=5)
    parser.add_argument("--resamples", type=int, default=10)
    arguments = parser.parse_args()
    if arguments.output.exists():
        raise FileExistsError(f"Assessment already exists: {arguments.output}")
    artists = pd.read_csv(ARTIST_METADATA_PATH, dtype={"id": str, "entity": str})
    edges = pd.read_parquet(INDEXED_EDGES_PATH, filters=[("relation", "==", "EXHIBITED_AT")])
    with threadpool_limits(limits=4):
        embeddings = np.load(arguments.embeddings)
        if arguments.validate:
            result, labels = validate(embeddings, artists, edges, arguments.components,
                                      arguments.min_cluster_size, arguments.min_samples,
                                      arguments.method, arguments.resamples)
            np.save(arguments.output.with_suffix(".labels.npy"), labels)
        else:
            result = assess(embeddings, artists, edges, arguments.method)
    result["embedding_sha256"] = file_hash(arguments.embeddings)
    write_json(arguments.output, result)


if __name__ == "__main__":
    main()
