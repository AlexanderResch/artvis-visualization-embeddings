from __future__ import annotations

import math
from pathlib import Path

import hdbscan
import numpy as np
import pandas as pd
import umap
from sklearn.manifold import trustworthiness
from sklearn.metrics import silhouette_score
from sklearn.neighbors import NearestNeighbors

from app.ml.config import (
    ARTIST_EMBEDDINGS_PATH,
    ARTIST_METADATA_PATH,
    EXPERIMENT_CLUSTER_INPUT_MODES,
    EXPERIMENT_HDBSCAN_METHODS,
    EXPERIMENT_METRIC_SAMPLE_SIZE,
    EXPERIMENT_NEIGHBORHOOD_K,
    EXPERIMENT_UMAP_MIN_DIST,
    EXPERIMENT_UMAP_N_NEIGHBORS,
    EXPERIMENT_UMAP_VARIANTS,
    HDBSCAN_MAX_NOISE_FRACTION,
    HDBSCAN_MIN_CLUSTER_SIZES,
    HDBSCAN_MIN_SAMPLES_VALUES,
    HDBSCAN_PCA_MAX_COMPONENTS,
    HDBSCAN_PCA_VARIANCE,
    POSTPROCESSING_CLUSTERING_RESULTS_PATH,
    POSTPROCESSING_EXPERIMENT_DIR,
    POSTPROCESSING_EXPERIMENT_PCA_PATH,
    POSTPROCESSING_PROJECTION_RESULTS_PATH,
    POSTPROCESSING_RECOMMENDATION_PATH,
    POSTPROCESSING_RECOMMENDED_ENV_PATH,
    RANDOM_SEED,
    SILHOUETTE_SAMPLE_SIZE,
)
from app.ml.representation import build_representation
from app.ml.utils import write_json


UMAP_VARIANTS = {
    "normalized_cosine": ("normalized", "cosine"),
    "normalized_euclidean": ("normalized", "euclidean"),
    "pca_euclidean": ("pca", "euclidean"),
}


def _new_hdbscan(
    min_cluster_size: int,
    min_samples: int,
    method: str,
) -> hdbscan.HDBSCAN:
    return hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        cluster_selection_method=method,
        gen_min_span_tree=True,
        prediction_data=True,
        core_dist_n_jobs=-1,
    )


def _clustering_metrics(
    data: np.ndarray,
    model: hdbscan.HDBSCAN,
    input_mode: str,
    method: str,
    min_cluster_size: int,
    min_samples: int,
) -> dict:
    labels = model.labels_.astype(int)
    clustered_mask = labels >= 0
    clustered_labels = labels[clustered_mask]
    clustered_data = data[clustered_mask]
    cluster_count = len(np.unique(clustered_labels))
    noise_fraction = float((~clustered_mask).mean())

    silhouette = None
    if cluster_count >= 2 and len(clustered_data) > cluster_count:
        sample_size = min(SILHOUETTE_SAMPLE_SIZE, len(clustered_data))
        silhouette = float(
            silhouette_score(
                clustered_data,
                clustered_labels,
                sample_size=(
                    sample_size if sample_size < len(clustered_data) else None
                ),
                random_state=RANDOM_SEED,
            )
        )

    probabilities = model.probabilities_[clustered_mask]
    persistence = model.cluster_persistence_

    return {
        "input_mode": input_mode,
        "cluster_selection_method": method,
        "min_cluster_size": min_cluster_size,
        "min_samples": min_samples,
        "cluster_count": cluster_count,
        "noise_fraction": noise_fraction,
        "relative_validity": float(model.relative_validity_),
        "silhouette": silhouette,
        "mean_membership_probability": (
            float(probabilities.mean()) if len(probabilities) else 0.0
        ),
        "mean_cluster_persistence": (
            float(persistence.mean()) if len(persistence) else 0.0
        ),
        "valid": (
            cluster_count >= 2
            and noise_fraction <= HDBSCAN_MAX_NOISE_FRACTION
            and silhouette is not None
        ),
    }


def _rank_clustering_results(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    valid_mask = result["valid"].astype(bool)
    result["selection_score"] = np.nan

    if not valid_mask.any():
        return result

    valid = result.loc[valid_mask].copy()
    valid["relative_validity_rank"] = valid["relative_validity"].rank(
        pct=True,
        ascending=True,
    )
    valid["silhouette_rank"] = valid["silhouette"].rank(
        pct=True,
        ascending=True,
    )
    valid["persistence_rank"] = valid["mean_cluster_persistence"].rank(
        pct=True,
        ascending=True,
    )
    valid["membership_rank"] = valid[
        "mean_membership_probability"
    ].rank(
        pct=True,
        ascending=True,
    )
    valid["noise_quality"] = 1.0 - valid["noise_fraction"]

    valid["selection_score"] = (
        0.35 * valid["relative_validity_rank"]
        + 0.25 * valid["silhouette_rank"]
        + 0.15 * valid["persistence_rank"]
        + 0.15 * valid["membership_rank"]
        + 0.10 * valid["noise_quality"]
    )
    result.loc[valid.index, "selection_score"] = valid["selection_score"]
    return result


def _sample_indices(size: int) -> np.ndarray:
    sample_size = min(EXPERIMENT_METRIC_SAMPLE_SIZE, size)
    rng = np.random.default_rng(RANDOM_SEED)
    return np.sort(rng.choice(size, size=sample_size, replace=False))


def _neighbor_indices(
    data: np.ndarray,
    query_indices: np.ndarray,
    k: int,
    metric: str = "euclidean",
) -> np.ndarray:
    neighbors = NearestNeighbors(
        n_neighbors=min(k + 1, len(data)),
        metric=metric,
        n_jobs=-1,
    )
    neighbors.fit(data)
    indices = neighbors.kneighbors(
        data[query_indices],
        return_distance=False,
    )

    result = np.empty((len(query_indices), min(k, len(data) - 1)), dtype=int)
    for row_index, (source_index, row) in enumerate(zip(query_indices, indices)):
        filtered = row[row != source_index]
        result[row_index] = filtered[: result.shape[1]]
    return result


def _knn_overlap(
    reference_neighbors: np.ndarray,
    projected_neighbors: np.ndarray,
) -> float:
    if reference_neighbors.shape != projected_neighbors.shape:
        raise ValueError("Neighbor arrays must have the same shape.")
    overlaps = []
    for reference_row, projected_row in zip(
        reference_neighbors,
        projected_neighbors,
    ):
        overlaps.append(
            len(set(reference_row.tolist()) & set(projected_row.tolist()))
            / len(reference_row)
        )
    return float(np.mean(overlaps)) if overlaps else 0.0


def _cluster_neighbor_purity(
    labels: np.ndarray,
    sample_indices: np.ndarray,
    projected_neighbors: np.ndarray,
) -> float:
    values = []
    for artist_index, neighbor_indices in zip(
        sample_indices,
        projected_neighbors,
    ):
        label = int(labels[artist_index])
        if label < 0:
            continue
        neighbor_labels = labels[neighbor_indices]
        values.append(float(np.mean(neighbor_labels == label)))
    return float(np.mean(values)) if values else 0.0


def _projection_silhouette(
    coordinates: np.ndarray,
    labels: np.ndarray,
    sample_indices: np.ndarray,
) -> float | None:
    sample_labels = labels[sample_indices]
    clustered = sample_labels >= 0
    selected_labels = sample_labels[clustered]
    selected_coordinates = coordinates[sample_indices][clustered]
    cluster_count = len(np.unique(selected_labels))
    if cluster_count < 2 or len(selected_coordinates) <= cluster_count:
        return None
    return float(silhouette_score(selected_coordinates, selected_labels))


def _projection_metrics(
    reference_data: np.ndarray,
    coordinates: np.ndarray,
    labels: np.ndarray,
    sample_indices: np.ndarray,
    reference_neighbors: np.ndarray,
) -> dict:
    k = min(EXPERIMENT_NEIGHBORHOOD_K, len(sample_indices) - 1)
    if k < 1:
        raise ValueError("Not enough observations for projection evaluation.")

    projected_neighbors = _neighbor_indices(
        coordinates,
        sample_indices,
        k=k,
        metric="euclidean",
    )

    trust = float(
        trustworthiness(
            reference_data[sample_indices],
            coordinates[sample_indices],
            n_neighbors=min(k, max(1, (len(sample_indices) - 1) // 2)),
            metric="euclidean",
        )
    )
    overlap = _knn_overlap(reference_neighbors, projected_neighbors)
    purity = _cluster_neighbor_purity(
        labels,
        sample_indices,
        projected_neighbors,
    )
    silhouette = _projection_silhouette(
        coordinates,
        labels,
        sample_indices,
    )
    scaled_silhouette = 0.0 if silhouette is None else (silhouette + 1.0) / 2.0

    score = (
        0.35 * trust
        + 0.25 * overlap
        + 0.25 * purity
        + 0.15 * scaled_silhouette
    )

    return {
        "trustworthiness": trust,
        "knn_overlap": overlap,
        "cluster_neighbor_purity": purity,
        "projection_silhouette": silhouette,
        "projection_score": score,
    }


def _validate_experiment_settings() -> None:
    invalid_inputs = set(EXPERIMENT_CLUSTER_INPUT_MODES) - {
        "normalized",
        "pca",
    }
    if invalid_inputs:
        raise ValueError(
            f"Invalid EXPERIMENT_CLUSTER_INPUT_MODES: {sorted(invalid_inputs)}"
        )

    invalid_methods = set(EXPERIMENT_HDBSCAN_METHODS) - {"eom", "leaf"}
    if invalid_methods:
        raise ValueError(
            f"Invalid EXPERIMENT_HDBSCAN_METHODS: {sorted(invalid_methods)}"
        )

    invalid_variants = set(EXPERIMENT_UMAP_VARIANTS) - set(UMAP_VARIANTS)
    if invalid_variants:
        raise ValueError(
            f"Invalid EXPERIMENT_UMAP_VARIANTS: {sorted(invalid_variants)}"
        )


def run() -> None:
    _validate_experiment_settings()
    POSTPROCESSING_EXPERIMENT_DIR.mkdir(parents=True, exist_ok=True)

    embeddings = np.load(ARTIST_EMBEDDINGS_PATH)
    metadata = pd.read_csv(
        ARTIST_METADATA_PATH,
        dtype={"id": str, "entity": str},
    )
    if len(embeddings) != len(metadata):
        raise ValueError("Artist embeddings and metadata are not aligned.")

    representations = {
        "normalized": build_representation(
            embeddings=embeddings,
            input_mode="normalized",
            variance_threshold=HDBSCAN_PCA_VARIANCE,
            max_components=HDBSCAN_PCA_MAX_COMPONENTS,
            random_seed=RANDOM_SEED,
        ),
        "pca": build_representation(
            embeddings=embeddings,
            input_mode="pca",
            variance_threshold=HDBSCAN_PCA_VARIANCE,
            max_components=HDBSCAN_PCA_MAX_COMPONENTS,
            random_seed=RANDOM_SEED,
            pca_path=POSTPROCESSING_EXPERIMENT_PCA_PATH,
            fit_pca=True,
        ),
    }

    clustering_rows: list[dict] = []
    print("\n=== Comparing clustering spaces ===")
    for input_mode in EXPERIMENT_CLUSTER_INPUT_MODES:
        data = representations[input_mode].data
        for method in EXPERIMENT_HDBSCAN_METHODS:
            for min_cluster_size in HDBSCAN_MIN_CLUSTER_SIZES:
                for min_samples in HDBSCAN_MIN_SAMPLES_VALUES:
                    print(
                        f"Clustering input={input_mode}, method={method}, "
                        f"min_cluster_size={min_cluster_size}, "
                        f"min_samples={min_samples}"
                    )
                    model = _new_hdbscan(
                        min_cluster_size,
                        min_samples,
                        method,
                    ).fit(data)
                    clustering_rows.append(
                        _clustering_metrics(
                            data=data,
                            model=model,
                            input_mode=input_mode,
                            method=method,
                            min_cluster_size=min_cluster_size,
                            min_samples=min_samples,
                        )
                    )

    clustering_results = _rank_clustering_results(
        pd.DataFrame(clustering_rows)
    )
    clustering_results = clustering_results.sort_values(
        ["selection_score", "relative_validity", "silhouette"],
        ascending=[False, False, False],
        na_position="last",
    )
    clustering_results.to_csv(
        POSTPROCESSING_CLUSTERING_RESULTS_PATH,
        index=False,
    )

    valid_clustering = clustering_results.loc[
        clustering_results["valid"]
        & clustering_results["selection_score"].notna()
    ]
    if valid_clustering.empty:
        raise RuntimeError(
            "No valid clustering candidate was found. Inspect "
            f"{POSTPROCESSING_CLUSTERING_RESULTS_PATH}."
        )

    best_clustering = valid_clustering.iloc[0]
    reference_mode = str(best_clustering["input_mode"])
    reference_data = representations[reference_mode].data
    best_cluster_model = _new_hdbscan(
        int(best_clustering["min_cluster_size"]),
        int(best_clustering["min_samples"]),
        str(best_clustering["cluster_selection_method"]),
    ).fit(reference_data)
    labels = best_cluster_model.labels_.astype(int)
    np.save(
        POSTPROCESSING_EXPERIMENT_DIR / "recommended_cluster_labels.npy",
        labels,
    )

    sample_indices = _sample_indices(len(reference_data))
    k = min(EXPERIMENT_NEIGHBORHOOD_K, len(reference_data) - 1)
    reference_neighbors = _neighbor_indices(
        reference_data,
        sample_indices,
        k=k,
        metric="euclidean",
    )

    projection_rows: list[dict] = []
    print("\n=== Comparing 2D UMAP projections ===")
    for variant in EXPERIMENT_UMAP_VARIANTS:
        input_mode, metric = UMAP_VARIANTS[variant]
        projection_input = representations[input_mode].data

        for n_neighbors in EXPERIMENT_UMAP_N_NEIGHBORS:
            for min_dist in EXPERIMENT_UMAP_MIN_DIST:
                print(
                    f"UMAP variant={variant}, n_neighbors={n_neighbors}, "
                    f"min_dist={min_dist}"
                )
                reducer = umap.UMAP(
                    n_components=2,
                    n_neighbors=n_neighbors,
                    min_dist=min_dist,
                    metric=metric,
                    random_state=RANDOM_SEED,
                )
                coordinates = reducer.fit_transform(projection_input).astype(
                    np.float32
                )
                coordinate_name = (
                    f"umap_{variant}_n{n_neighbors}_d{min_dist:.2f}.npy"
                )
                np.save(
                    POSTPROCESSING_EXPERIMENT_DIR / coordinate_name,
                    coordinates,
                )

                metrics = _projection_metrics(
                    reference_data=reference_data,
                    coordinates=coordinates,
                    labels=labels,
                    sample_indices=sample_indices,
                    reference_neighbors=reference_neighbors,
                )
                projection_rows.append(
                    {
                        "variant": variant,
                        "input_mode": input_mode,
                        "metric": metric,
                        "n_neighbors": n_neighbors,
                        "min_dist": min_dist,
                        "coordinate_file": coordinate_name,
                        **metrics,
                    }
                )

    projection_results = pd.DataFrame(projection_rows).sort_values(
        [
            "projection_score",
            "trustworthiness",
            "knn_overlap",
            "cluster_neighbor_purity",
        ],
        ascending=[False, False, False, False],
    )
    projection_results.to_csv(
        POSTPROCESSING_PROJECTION_RESULTS_PATH,
        index=False,
    )
    best_projection = projection_results.iloc[0]

    recommendation = {
        "important": (
            "This is a quantitative preselection. Confirm the selected "
            "clustering with art-historical cluster profiles before using it "
            "in the thesis."
        ),
        "artist_count": int(len(embeddings)),
        "embedding_dimension": int(embeddings.shape[1]),
        "pca_dimension": int(representations["pca"].output_dimension),
        "pca_explained_variance": representations["pca"].explained_variance,
        "recommended_clustering": {
            "input_mode": reference_mode,
            "cluster_selection_method": str(
                best_clustering["cluster_selection_method"]
            ),
            "min_cluster_size": int(best_clustering["min_cluster_size"]),
            "min_samples": int(best_clustering["min_samples"]),
            "cluster_count": int(best_clustering["cluster_count"]),
            "noise_fraction": float(best_clustering["noise_fraction"]),
            "relative_validity": float(best_clustering["relative_validity"]),
            "silhouette": float(best_clustering["silhouette"]),
            "mean_membership_probability": float(
                best_clustering["mean_membership_probability"]
            ),
            "mean_cluster_persistence": float(
                best_clustering["mean_cluster_persistence"]
            ),
            "selection_score": float(best_clustering["selection_score"]),
        },
        "recommended_projection": {
            "variant": str(best_projection["variant"]),
            "input_mode": str(best_projection["input_mode"]),
            "metric": str(best_projection["metric"]),
            "n_neighbors": int(best_projection["n_neighbors"]),
            "min_dist": float(best_projection["min_dist"]),
            "trustworthiness": float(best_projection["trustworthiness"]),
            "knn_overlap": float(best_projection["knn_overlap"]),
            "cluster_neighbor_purity": float(
                best_projection["cluster_neighbor_purity"]
            ),
            "projection_silhouette": (
                None
                if pd.isna(best_projection["projection_silhouette"])
                else float(best_projection["projection_silhouette"])
            ),
            "projection_score": float(best_projection["projection_score"]),
            "coordinate_file": str(best_projection["coordinate_file"]),
        },
        "result_files": {
            "clustering": str(POSTPROCESSING_CLUSTERING_RESULTS_PATH),
            "projection": str(POSTPROCESSING_PROJECTION_RESULTS_PATH),
        },
        "manual_domain_check": [
            "Inspect at least three medium or large clusters.",
            "Compare common exhibitions, groups, locations, and active years.",
            "Check representative Artists with high membership probability.",
            "Reject a quantitatively strong configuration if its clusters are "
            "not interpretable for the art-historical tasks.",
        ],
    }
    write_json(POSTPROCESSING_RECOMMENDATION_PATH, recommendation)

    env_text = "\n".join(
        [
            "# Generated by app.ml.compare_postprocessing",
            "# Review the recommendation.json and perform the domain check first.",
            "FINAL_EPOCH_STRATEGY=evaluation_best",
            f"CLUSTER_INPUT_MODE={reference_mode}",
            "HDBSCAN_MIN_CLUSTER_SIZES="
            f"{int(best_clustering['min_cluster_size'])}",
            "HDBSCAN_MIN_SAMPLES_VALUES="
            f"{int(best_clustering['min_samples'])}",
            "HDBSCAN_CLUSTER_SELECTION_METHOD="
            f"{str(best_clustering['cluster_selection_method'])}",
            f"UMAP_INPUT_MODE={str(best_projection['input_mode'])}",
            f"UMAP_METRIC={str(best_projection['metric'])}",
            f"UMAP_N_NEIGHBORS={int(best_projection['n_neighbors'])}",
            f"UMAP_MIN_DIST={float(best_projection['min_dist']):.2f}",
            "",
        ]
    )
    POSTPROCESSING_RECOMMENDED_ENV_PATH.write_text(
        env_text,
        encoding="utf-8",
    )

    print("\n=== Quantitative recommendation ===")
    print(recommendation["recommended_clustering"])
    print(recommendation["recommended_projection"])
    print(
        "Perform the manual domain check before applying recommended.env."
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()
