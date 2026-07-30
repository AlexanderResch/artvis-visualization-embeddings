from __future__ import annotations

import joblib
import hdbscan
import numpy as np
import pandas as pd
from sklearn.metrics import (
    calinski_harabasz_score,
    davies_bouldin_score,
    silhouette_score,
)

from app.ml.config import (
    ARTIST_CLUSTERS_PATH,
    ARTIST_EMBEDDINGS_PATH,
    ARTIST_METADATA_PATH,
    CLUSTER_INPUT_MODE,
    HDBSCAN_CANDIDATES_PATH,
    HDBSCAN_CLUSTER_SELECTION_METHOD,
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
from app.ml.representation import build_representation
from app.ml.utils import write_json


def _evaluate(
    data: np.ndarray,
    model: hdbscan.HDBSCAN,
    min_cluster_size: int,
    min_samples: int,
) -> dict:
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
        davies_bouldin = float(
            davies_bouldin_score(clustered_data, clustered_labels)
        )
        calinski_harabasz = float(
            calinski_harabasz_score(clustered_data, clustered_labels)
        )

    probabilities = model.probabilities_[clustered_mask]
    persistence = model.cluster_persistence_

    return {
        "input_mode": CLUSTER_INPUT_MODE,
        "cluster_selection_method": HDBSCAN_CLUSTER_SELECTION_METHOD,
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
        "mean_membership_probability": (
            float(probabilities.mean()) if len(probabilities) else 0.0
        ),
        "mean_cluster_persistence": (
            float(persistence.mean()) if len(persistence) else 0.0
        ),
        "valid": (
            cluster_count >= 2
            and noise_fraction <= HDBSCAN_MAX_NOISE_FRACTION
        ),
    }


def _new_model(
    min_cluster_size: int,
    min_samples: int,
) -> hdbscan.HDBSCAN:
    return hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        cluster_selection_method=HDBSCAN_CLUSTER_SELECTION_METHOD,
        gen_min_span_tree=True,
        prediction_data=True,
        core_dist_n_jobs=-1,
    )


def run() -> None:
    embeddings = np.load(ARTIST_EMBEDDINGS_PATH)
    metadata = pd.read_csv(
        ARTIST_METADATA_PATH,
        dtype={"id": str, "entity": str},
    )

    if len(embeddings) != len(metadata):
        raise ValueError("Artist embeddings and metadata are not aligned.")

    # Fit and save one PCA model for the current embedding file even when
    # clustering is tested directly on normalized embeddings. This prevents
    # the projection step from accidentally loading a stale PCA model.
    shared_pca = build_representation(
        embeddings=embeddings,
        input_mode="pca",
        variance_threshold=HDBSCAN_PCA_VARIANCE,
        max_components=HDBSCAN_PCA_MAX_COMPONENTS,
        random_seed=RANDOM_SEED,
        pca_path=HDBSCAN_PCA_PATH,
        fit_pca=True,
    )

    representation = (
        shared_pca
        if CLUSTER_INPUT_MODE == "pca"
        else build_representation(
            embeddings=embeddings,
            input_mode="normalized",
            variance_threshold=HDBSCAN_PCA_VARIANCE,
            max_components=HDBSCAN_PCA_MAX_COMPONENTS,
            random_seed=RANDOM_SEED,
        )
    )
    clustering_input = representation.data

    evaluations: list[dict] = []
    for min_cluster_size in HDBSCAN_MIN_CLUSTER_SIZES:
        for min_samples in HDBSCAN_MIN_SAMPLES_VALUES:
            print(
                "HDBSCAN "
                f"input={CLUSTER_INPUT_MODE}, "
                f"method={HDBSCAN_CLUSTER_SELECTION_METHOD}, "
                f"min_cluster_size={min_cluster_size}, "
                f"min_samples={min_samples}"
            )
            model = _new_model(min_cluster_size, min_samples).fit(
                clustering_input
            )
            evaluations.append(
                _evaluate(
                    clustering_input,
                    model,
                    min_cluster_size,
                    min_samples,
                )
            )

    candidates = pd.DataFrame(evaluations)
    candidates.to_csv(HDBSCAN_CANDIDATES_PATH, index=False)

    valid = candidates.loc[candidates["valid"]].copy()
    used_fallback = False
    if valid.empty:
        valid = candidates.loc[
            (candidates["cluster_count"] >= 2)
            & candidates["silhouette"].notna()
        ].copy()
        used_fallback = True

    if valid.empty:
        raise RuntimeError(
            "No HDBSCAN configuration produced at least two clusters."
        )

    best = valid.sort_values(
        [
            "relative_validity",
            "silhouette",
            "mean_cluster_persistence",
            "mean_membership_probability",
        ],
        ascending=[False, False, False, False],
    ).iloc[0]

    model = _new_model(
        int(best["min_cluster_size"]),
        int(best["min_samples"]),
    ).fit(clustering_input)
    joblib.dump(model, HDBSCAN_MODEL_PATH)

    output = metadata.copy()
    output["cluster"] = model.labels_.astype(int)
    output["is_noise"] = output["cluster"].eq(-1)
    output["membership_probability"] = model.probabilities_.astype(float)
    output["outlier_score"] = np.nan_to_num(
        model.outlier_scores_.astype(float),
        nan=0.0,
        posinf=1.0,
    )
    output.to_csv(ARTIST_CLUSTERS_PATH, index=False)

    cluster_sizes = (
        output.loc[~output["is_noise"]]
        .groupby("cluster")
        .size()
        .sort_index()
        .to_dict()
    )

    summary = {
        "algorithm": "HDBSCAN",
        "input_mode": representation.input_mode,
        "input": (
            "PCA representation of L2-normalized final Artist embeddings"
            if representation.input_mode == "pca"
            else "L2-normalized final Artist embeddings without PCA"
        ),
        "original_dimension": representation.original_dimension,
        "clustering_dimension": representation.output_dimension,
        "pca_explained_variance": representation.explained_variance,
        "selected_parameters": {
            "min_cluster_size": int(best["min_cluster_size"]),
            "min_samples": int(best["min_samples"]),
            "cluster_selection_method": HDBSCAN_CLUSTER_SELECTION_METHOD,
            "metric": "euclidean",
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
        "cluster_sizes": {
            str(key): int(value) for key, value in cluster_sizes.items()
        },
        "noise_count": int(output["is_noise"].sum()),
        "noise_fraction": float(output["is_noise"].mean()),
        "selection_used_fallback": used_fallback,
        "candidate_results": str(HDBSCAN_CANDIDATES_PATH),
        "shared_pca_model": str(HDBSCAN_PCA_PATH),
        "shared_pca_dimension": shared_pca.output_dimension,
        "shared_pca_explained_variance": shared_pca.explained_variance,
    }
    write_json(HDBSCAN_SUMMARY_PATH, summary)
    print(
        f"Selected {summary['cluster_count']} clusters with "
        f"{summary['noise_fraction']:.1%} noise."
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()
