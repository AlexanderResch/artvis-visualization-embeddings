"""Controlled comparison: identical embeddings and HDBSCAN settings, with/without PCA."""

import time
from importlib.metadata import version

import numpy as np
from sklearn.metrics import adjusted_rand_score, silhouette_score

from app.ml.cluster_artists import (
    clustering_metrics, fit_clustering, load_embeddings, representation,
)
from app.ml.config import (
    ARTIST_EMBEDDINGS_PATH, HDBSCAN_CLUSTER_SELECTION_METHOD, HDBSCAN_MIN_CLUSTER_SIZE, HDBSCAN_MIN_SAMPLES, PCA_COMPARISON_PATH,
    PCA_VARIANCE, RANDOM_SEED,
)
from app.ml.prepare_training_data import file_hash
from app.ml.utils import write_json


def compare(embeddings):
    generator = np.random.default_rng(RANDOM_SEED)
    sample = generator.choice(len(embeddings), min(2000, len(embeddings)), replace=False)
    # All variants see exactly the same three 80% subsets.
    subsets = [np.sort(generator.choice(len(embeddings), int(0.8 * len(embeddings)), replace=False))
               for _ in range(3)]
    variants = {"raw": None, "pca": PCA_VARIANCE}
    for components in (32, 16, 10):
        if components < min(embeddings.shape):
            variants[f"pca_{components}"] = components
    results, labels = {}, {}
    for name, components in variants.items():
        use_pca = components is not None
        started = time.perf_counter()
        data, pca = representation(embeddings, use_pca, components)
        projection_seconds = time.perf_counter() - started
        started = time.perf_counter()
        model = fit_clustering(data)
        seconds = time.perf_counter() - started
        labels[name] = model.labels_
        stability = []
        for subset in subsets:
            # Refit PCA within each subset; do not leak the full-data PCA fit.
            subset_data, _ = representation(embeddings[subset], use_pca, components)
            subset_labels = fit_clustering(subset_data).labels_
            stability.append(float(adjusted_rand_score(model.labels_[subset], subset_labels)))
        results[name] = {
            "dimension": data.shape[1],
            "retained_variance": float(pca.explained_variance_ratio_.sum()) if pca is not None else 1.0,
            "preprocessing_seconds": projection_seconds, "clustering_seconds": seconds,
            **clustering_metrics(model, embeddings, sample),
            "subsample_ari_including_noise": stability,
            "mean_subsample_ari_including_noise": float(np.mean(stability)),
        }
        print(f"PCA comparison {name}: {results[name]}", flush=True)
    # Compare partitions on the same assigned artists in the same original space.
    common = sample[np.logical_and.reduce([values[sample] >= 0 for values in labels.values()])]
    for name in results:
        common_labels = labels[name][common]
        results[name]["silhouette_common_assigned_original_space"] = (
            float(silhouette_score(embeddings[common], common_labels))
            if 1 < len(np.unique(common_labels)) < len(common) else None
        )
    return {
        "random_seed": RANDOM_SEED, "artist_count": len(embeddings),
        "library_versions": {name: version(name) for name in ("numpy", "scikit-learn", "hdbscan")},
        "embedding_dimension": embeddings.shape[1], "pca_variance_target": PCA_VARIANCE,
        "hdbscan_parameters": {"min_cluster_size": HDBSCAN_MIN_CLUSTER_SIZE,
                               "min_samples": HDBSCAN_MIN_SAMPLES,
                               "metric": "euclidean", "cluster_selection_method": HDBSCAN_CLUSTER_SELECTION_METHOD},
        "variants": results, "common_assigned_sample_count": len(common),
        "partition_ari_vs_raw_including_noise": {
            name: float(adjusted_rand_score(labels["raw"], values))
            for name, values in labels.items() if name != "raw"
        },
        "scope": "One trained model; raw versus PCA retaining 95% variance and PCA with 32/16/10 components where feasible. UMAP is not used for clustering.",
        "limitations": [
            "Internal metrics do not establish art-historical validity; there are no reference cluster labels.",
            "Subsample ARI includes noise as one label and measures clustering stability, not training-seed stability.",
            "Silhouettes exclude noise; the common-assigned score uses identical artists and the original embedding space.",
            "Relative validity and persistence are measured in each variant's own space; they are not a standalone selection rule.",
            "Runtime depends on machine load. No automatic choice is made from a single score.",
        ],
    }


def run():
    result = compare(load_embeddings())
    result["embedding_sha256"] = file_hash(ARTIST_EMBEDDINGS_PATH)
    write_json(PCA_COMPARISON_PATH, result)


if __name__ == "__main__":
    run()
