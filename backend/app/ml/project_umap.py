from __future__ import annotations

import joblib
import numpy as np
import umap

from app.ml.config import (
    ARTIST_EMBEDDINGS_PATH,
    HDBSCAN_PCA_MAX_COMPONENTS,
    HDBSCAN_PCA_PATH,
    HDBSCAN_PCA_VARIANCE,
    PROJECTION_SUMMARY_PATH,
    RANDOM_SEED,
    UMAP_2D_COORDS_PATH,
    UMAP_2D_MODEL_PATH,
    UMAP_3D_COORDS_PATH,
    UMAP_3D_MODEL_PATH,
    UMAP_INPUT_MODE,
    UMAP_METRIC,
    UMAP_MIN_DIST,
    UMAP_N_NEIGHBORS,
)
from app.ml.representation import build_representation
from app.ml.utils import write_json


def create_reducer(dimensions: int) -> umap.UMAP:
    return umap.UMAP(
        n_components=dimensions,
        n_neighbors=UMAP_N_NEIGHBORS,
        min_dist=UMAP_MIN_DIST,
        metric=UMAP_METRIC,
        random_state=RANDOM_SEED,
    )


def run() -> None:
    embeddings = np.load(ARTIST_EMBEDDINGS_PATH)

    representation = build_representation(
        embeddings=embeddings,
        input_mode=UMAP_INPUT_MODE,
        variance_threshold=HDBSCAN_PCA_VARIANCE,
        max_components=HDBSCAN_PCA_MAX_COMPONENTS,
        random_seed=RANDOM_SEED,
        pca_path=HDBSCAN_PCA_PATH,
        fit_pca=False if UMAP_INPUT_MODE == "pca" else True,
    )
    projection_input = representation.data

    reducer_2d = create_reducer(2)
    coordinates_2d = reducer_2d.fit_transform(projection_input).astype(
        np.float32
    )
    np.save(UMAP_2D_COORDS_PATH, coordinates_2d)
    joblib.dump(reducer_2d, UMAP_2D_MODEL_PATH)

    reducer_3d = create_reducer(3)
    coordinates_3d = reducer_3d.fit_transform(projection_input).astype(
        np.float32
    )
    np.save(UMAP_3D_COORDS_PATH, coordinates_3d)
    joblib.dump(reducer_3d, UMAP_3D_MODEL_PATH)

    write_json(
        PROJECTION_SUMMARY_PATH,
        {
            "artist_count": len(embeddings),
            "embedding_dimension": int(embeddings.shape[1]),
            "input_mode": representation.input_mode,
            "projection_input_dimension": representation.output_dimension,
            "pca_explained_variance": representation.explained_variance,
            "shared_pca_model": (
                str(HDBSCAN_PCA_PATH)
                if representation.input_mode == "pca"
                else None
            ),
            "n_neighbors": UMAP_N_NEIGHBORS,
            "min_dist": UMAP_MIN_DIST,
            "metric": UMAP_METRIC,
            "random_seed": RANDOM_SEED,
            "note": (
                "2D and 3D UMAP models are fitted independently. "
                "Cluster labels are not supplied to UMAP."
            ),
        },
    )

    print(
        f"Saved UMAP projections for {len(embeddings):,} Artists "
        f"using input_mode={representation.input_mode}, "
        f"metric={UMAP_METRIC}."
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()
