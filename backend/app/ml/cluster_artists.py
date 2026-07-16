import joblib
import hdbscan
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score
from sklearn.preprocessing import normalize

from app.ml.config import (
    ARTIST_CLUSTERS_PATH,
    ARTIST_EMBEDDINGS_PATH,
    ARTIST_METADATA_PATH,
    HDBSCAN_CANDIDATES_PATH,
    HDBSCAN_MAX_NOISE_FRACTION,
    HDBSCAN_MIN_CLUSTER_SIZES,
    HDBSCAN_MIN_SAMPLES_VALUES,
    HDBSCAN_MODEL_PATH,
    HDBSCAN_PCA_MAX_COMPONENTS,
    HDBSCAN_PCA_PATH,
    HDBSCAN_PCA_VARIANCE,
    HDBSCAN_SUMMARY_PATH,
    RANDOM_SEED,
    SILHOUETTE_SAMPLE_SIZE,
)
from app.ml.utils import write_json


def _pca_representation(embeddings: np.ndarray) -> tuple[np.ndarray, PCA, int, float]:
    normalized = normalize(embeddings, norm="l2")
    maximum = min(HDBSCAN_PCA_MAX_COMPONENTS, normalized.shape[1], len(normalized) - 1)
    initial = PCA(n_components=maximum, svd_solver="randomized", random_state=RANDOM_SEED)
    transformed = initial.fit_transform(normalized)
    cumulative = np.cumsum(initial.explained_variance_ratio_)
    selected = int(np.searchsorted(cumulative, HDBSCAN_PCA_VARIANCE) + 1)
    selected = min(max(selected, 2), maximum)
    if selected == maximum:
        pca = initial
        result = transformed
    else:
        pca = PCA(n_components=selected, svd_solver="randomized", random_state=RANDOM_SEED)
        result = pca.fit_transform(normalized)
    explained = float(np.sum(pca.explained_variance_ratio_))
    return result, pca, selected, explained


def _evaluate(data: np.ndarray, model: hdbscan.HDBSCAN, min_cluster_size: int, min_samples: int) -> dict:
    labels = model.labels_.astype(int)
    clustered_mask = labels >= 0
    clustered_labels = labels[clustered_mask]
    clustered_data = data[clustered_mask]
    cluster_count = len(np.unique(clustered_labels))
    noise_count = int((~clustered_mask).sum())
    noise_fraction = noise_count / len(labels) if len(labels) else 0.0

    silhouette = None
    davies_bouldin = None
    calinski_harabasz = None
    sample_size = 0
    if cluster_count >= 2 and len(clustered_data) > cluster_count:
        sample_size = min(SILHOUETTE_SAMPLE_SIZE, len(clustered_data))
        silhouette = float(silhouette_score(
            clustered_data,
            clustered_labels,
            sample_size=sample_size if sample_size < len(clustered_data) else None,
            random_state=RANDOM_SEED,
        ))
        davies_bouldin = float(davies_bouldin_score(clustered_data, clustered_labels))
        calinski_harabasz = float(calinski_harabasz_score(clustered_data, clustered_labels))

    probabilities = model.probabilities_[clustered_mask]
    persistence = model.cluster_persistence_
    return {
        "min_cluster_size": min_cluster_size,
        "min_samples": min_samples,
        "cluster_count": cluster_count,
        "clustered_artist_count": int(clustered_mask.sum()),
        "noise_count": noise_count,
        "noise_fraction": noise_fraction,
        "relative_validity": float(model.relative_validity_),
        "silhouette": silhouette,
        "silhouette_sample_size": sample_size,
        "davies_bouldin": davies_bouldin,
        "calinski_harabasz": calinski_harabasz,
        "mean_membership_probability": float(probabilities.mean()) if len(probabilities) else 0.0,
        "mean_cluster_persistence": float(persistence.mean()) if len(persistence) else 0.0,
        "valid": cluster_count >= 2 and noise_fraction <= HDBSCAN_MAX_NOISE_FRACTION,
    }


def _new_model(min_cluster_size: int, min_samples: int) -> hdbscan.HDBSCAN:
    return hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        cluster_selection_method="eom",
        gen_min_span_tree=True,
        prediction_data=True,
        core_dist_n_jobs=-1,
    )


def run() -> None:
    embeddings = np.load(ARTIST_EMBEDDINGS_PATH)
    metadata = pd.read_csv(ARTIST_METADATA_PATH, dtype={"id": str, "entity": str})
    if len(embeddings) != len(metadata):
        raise ValueError("Artist embeddings and metadata are not aligned")
    if not np.isfinite(embeddings).all():
        raise ValueError("Artist embeddings contain non-finite values")

    clustering_input, pca, pca_components, explained_variance = _pca_representation(embeddings)
    joblib.dump(pca, HDBSCAN_PCA_PATH)

    evaluations: list[dict] = []
    for min_cluster_size in HDBSCAN_MIN_CLUSTER_SIZES:
        for min_samples in HDBSCAN_MIN_SAMPLES_VALUES:
            print(f"HDBSCAN min_cluster_size={min_cluster_size}, min_samples={min_samples}")
            model = _new_model(min_cluster_size, min_samples).fit(clustering_input)
            evaluations.append(_evaluate(clustering_input, model, min_cluster_size, min_samples))

    candidates = pd.DataFrame(evaluations)
    candidates.to_csv(HDBSCAN_CANDIDATES_PATH, index=False)
    valid = candidates.loc[candidates["valid"]].copy()
    used_fallback = False
    if valid.empty:
        valid = candidates.loc[(candidates["cluster_count"] >= 2) & candidates["silhouette"].notna()].copy()
        used_fallback = True
    if valid.empty:
        raise RuntimeError("No HDBSCAN configuration produced at least two clusters")

    best = valid.sort_values(
        ["relative_validity", "silhouette", "mean_cluster_persistence", "mean_membership_probability"],
        ascending=[False, False, False, False],
    ).iloc[0]
    model = _new_model(int(best["min_cluster_size"]), int(best["min_samples"])).fit(clustering_input)
    joblib.dump(model, HDBSCAN_MODEL_PATH)

    output = metadata.copy()
    output["cluster"] = model.labels_.astype(int)
    output["is_noise"] = output["cluster"].eq(-1)
    output["membership_probability"] = model.probabilities_.astype(float)
    output["outlier_score"] = np.nan_to_num(model.outlier_scores_.astype(float), nan=0.0, posinf=1.0)
    output.to_csv(ARTIST_CLUSTERS_PATH, index=False)

    cluster_sizes = output.loc[~output["is_noise"]].groupby("cluster").size().sort_index().to_dict()
    summary = {
        "algorithm": "HDBSCAN",
        "input": "PCA representation of L2-normalized final Artist embeddings",
        "original_dimension": embeddings.shape[1],
        "pca_components": pca_components,
        "pca_explained_variance": explained_variance,
        "selected_parameters": {
            "min_cluster_size": int(best["min_cluster_size"]),
            "min_samples": int(best["min_samples"]),
            "cluster_selection_method": "eom",
        },
        "selected_metrics": {
            key: (None if pd.isna(best[key]) else float(best[key]))
            for key in (
                "relative_validity",
                "silhouette",
                "davies_bouldin",
                "calinski_harabasz",
                "noise_fraction",
                "mean_membership_probability",
                "mean_cluster_persistence",
            )
        },
        "cluster_count": len(cluster_sizes),
        "cluster_sizes": {str(key): int(value) for key, value in cluster_sizes.items()},
        "noise_count": int(output["is_noise"].sum()),
        "noise_fraction": float(output["is_noise"].mean()),
        "selection_used_fallback": used_fallback,
        "candidate_results": HDBSCAN_CANDIDATES_PATH,
    }
    write_json(HDBSCAN_SUMMARY_PATH, summary)
    print(f"Selected {summary['cluster_count']} clusters with {summary['noise_fraction']:.1%} noise")


def main() -> None:
    run()


if __name__ == "__main__":
    main()
