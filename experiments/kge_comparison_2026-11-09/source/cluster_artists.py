"""HDBSCAN on artist embeddings, optionally preceded by PCA."""

import time

import hdbscan
import joblib
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

from app.ml.config import (
    ARTIST_CLUSTERS_PATH, ARTIST_EMBEDDINGS_PATH, ARTIST_METADATA_PATH,
    HDBSCAN_CLUSTER_SELECTION_METHOD, HDBSCAN_MIN_CLUSTER_SIZE, HDBSCAN_MIN_SAMPLES, HDBSCAN_MODEL_PATH,
    EMBEDDING_SUMMARY_PATH, HDBSCAN_PCA_PATH, HDBSCAN_SUMMARY_PATH, PCA_COMPONENTS, RANDOM_SEED, USE_PCA,
)
from app.ml.utils import read_json, write_json
from app.ml.prepare_training_data import file_hash


def load_embeddings():
    embeddings = np.load(ARTIST_EMBEDDINGS_PATH)
    if embeddings.ndim != 2 or len(embeddings) < 3 or not np.isfinite(embeddings).all():
        raise ValueError("Expected at least three finite artist embedding vectors.")
    return embeddings


def representation(embeddings, use_pca, components=PCA_COMPONENTS):
    if not use_pca:
        return embeddings, None
    pca = PCA(n_components=components, svd_solver="full")
    return pca.fit_transform(embeddings).astype(np.float32), pca


def fit_clustering(data):
    model = hdbscan.HDBSCAN(
        min_cluster_size=HDBSCAN_MIN_CLUSTER_SIZE, min_samples=HDBSCAN_MIN_SAMPLES,
        metric="euclidean", cluster_selection_method=HDBSCAN_CLUSTER_SELECTION_METHOD, gen_min_span_tree=True,
        approx_min_span_tree=False, core_dist_n_jobs=1,
    )
    return model.fit(data)


def clustering_metrics(model, original_embeddings, sample_indices):
    labels = model.labels_
    counts = np.unique(labels[labels >= 0], return_counts=True)[1]
    assigned = sample_indices[labels[sample_indices] >= 0]
    sampled_labels = labels[assigned]
    silhouette = None
    if 1 < len(np.unique(sampled_labels)) < len(assigned):
        silhouette = float(silhouette_score(original_embeddings[assigned], sampled_labels))
    return {
        "cluster_count": len(counts), "noise_fraction": float(np.mean(labels < 0)),
        "largest_cluster_fraction": float(counts.max() / len(labels)) if len(counts) else 0.0,
        "relative_validity": float(model.relative_validity_) if len(counts) else None,
        "mean_cluster_persistence": float(np.mean(model.cluster_persistence_)) if len(counts) else None,
        "mean_membership_probability": float(model.probabilities_[labels >= 0].mean()) if len(counts) else None,
        "silhouette_original_space": silhouette, "silhouette_assigned_sample_count": len(assigned),
    }


def run():
    embeddings = load_embeddings()
    embedding_model = read_json(EMBEDDING_SUMMARY_PATH)["model"]
    metadata = pd.read_csv(ARTIST_METADATA_PATH, dtype={"entity": str, "id": str})
    if len(metadata) != len(embeddings) or not np.array_equal(metadata.artist_index, np.arange(len(embeddings))):
        raise ValueError("Artist metadata and embedding order do not match.")
    data, pca = representation(embeddings, USE_PCA)
    started = time.perf_counter()
    model = fit_clustering(data)
    duration = time.perf_counter() - started
    sample = np.random.default_rng(RANDOM_SEED).choice(len(data), min(2000, len(data)), replace=False)
    metrics = clustering_metrics(model, embeddings, sample)
    metadata["cluster"] = model.labels_
    metadata["is_noise"] = model.labels_ < 0
    metadata["membership_probability"] = model.probabilities_
    metadata["outlier_score"] = model.outlier_scores_
    metadata.to_csv(ARTIST_CLUSTERS_PATH, index=False)
    joblib.dump(model, HDBSCAN_MODEL_PATH)
    if pca is not None:
        joblib.dump(pca, HDBSCAN_PCA_PATH)
    sizes = metadata.loc[~metadata.is_noise, "cluster"].value_counts().sort_index()
    write_json(HDBSCAN_SUMMARY_PATH, {
        "algorithm": "HDBSCAN", "input_mode": "pca" if USE_PCA else "raw",
        "embedding_sha256": file_hash(ARTIST_EMBEDDINGS_PATH),
        "embedding_model": embedding_model,
        "input": f"{embedding_model} entity embeddings; no additional L2 normalization",
        "original_dimension": embeddings.shape[1], "clustering_dimension": data.shape[1],
        "pca_explained_variance": float(pca.explained_variance_ratio_.sum()) if pca is not None else None,
        "selected_parameters": {"min_cluster_size": HDBSCAN_MIN_CLUSTER_SIZE,
                                "min_samples": HDBSCAN_MIN_SAMPLES,
                                "metric": "euclidean", "cluster_selection_method": HDBSCAN_CLUSTER_SELECTION_METHOD},
        "selected_metrics": metrics, "cluster_count": len(sizes),
        "cluster_sizes": sizes.to_dict(), "noise_count": int(metadata.is_noise.sum()),
        "noise_fraction": metrics["noise_fraction"], "clustering_seconds": duration,
        "parameter_selection": "Configured parameters; this step performs no parameter search.",
        "membership_note": "HDBSCAN assignment strength is not a calibrated semantic probability.",
    })
    print(f"HDBSCAN: {len(sizes)} clusters, {metrics['noise_fraction']:.1%} noise, PCA={USE_PCA}.", flush=True)


if __name__ == "__main__":
    run()
