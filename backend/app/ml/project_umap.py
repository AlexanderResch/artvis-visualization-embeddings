import joblib
import numpy as np
import umap

from sklearn.preprocessing import (
    normalize
)

from app.ml.config import (
    ARTIST_EMBEDDINGS_PATH,
    PROJECTION_SUMMARY_PATH,
    RANDOM_SEED,
    UMAP_2D_COORDS_PATH,
    UMAP_2D_MODEL_PATH,
    UMAP_3D_COORDS_PATH,
    UMAP_3D_MODEL_PATH,
    UMAP_METRIC,
    UMAP_MIN_DIST,
    UMAP_N_NEIGHBORS,
)

from app.ml.utils import (
    write_json
)


def create_reducer(
        dimensions: int
) -> umap.UMAP:
    return umap.UMAP(
        n_components=dimensions,

        n_neighbors=(
            UMAP_N_NEIGHBORS
        ),

        min_dist=(
            UMAP_MIN_DIST
        ),

        metric=(
            UMAP_METRIC
        ),

        random_state=(
            RANDOM_SEED
        ),
    )


def run() -> None:
    embeddings = np.load(
        ARTIST_EMBEDDINGS_PATH
    )

    projection_input = normalize(
        embeddings,
        norm="l2"
    )

    reducer_2d = (
        create_reducer(2)
    )

    coordinates_2d = (
        reducer_2d
        .fit_transform(
            projection_input
        )
        .astype(
            np.float32
        )
    )

    np.save(
        UMAP_2D_COORDS_PATH,
        coordinates_2d
    )

    joblib.dump(
        reducer_2d,
        UMAP_2D_MODEL_PATH
    )

    reducer_3d = (
        create_reducer(3)
    )

    coordinates_3d = (
        reducer_3d
        .fit_transform(
            projection_input
        )
        .astype(
            np.float32
        )
    )

    np.save(
        UMAP_3D_COORDS_PATH,
        coordinates_3d
    )

    joblib.dump(
        reducer_3d,
        UMAP_3D_MODEL_PATH
    )

    write_json(
        PROJECTION_SUMMARY_PATH,
        {
            "artist_count": (
                len(embeddings)
            ),

            "input_dimension": (
                embeddings.shape[1]
            ),

            "n_neighbors": (
                UMAP_N_NEIGHBORS
            ),

            "min_dist": (
                UMAP_MIN_DIST
            ),

            "metric": (
                UMAP_METRIC
            ),

            "random_seed": (
                RANDOM_SEED
            ),

            "note": (
                "2D and 3D UMAP "
                "models are fitted "
                "independently and "
                "are used only for "
                "visualization."
            ),
        },
    )

    print(
        f"Saved UMAP projections "
        f"for {len(embeddings):,} "
        f"Artists"
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()