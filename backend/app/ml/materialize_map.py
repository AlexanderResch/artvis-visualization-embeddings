import numpy as np
import pandas as pd

from app.ml.config import (
    ARTIST_CLUSTERS_PATH,
    ARTIST_MAP_2D_CSV_PATH,
    ARTIST_MAP_2D_PATH,
    ARTIST_MAP_3D_CSV_PATH,
    ARTIST_MAP_3D_PATH,
    UMAP_2D_COORDS_PATH,
    UMAP_3D_COORDS_PATH,
)


MAP_COLUMNS = [
    "artist_index",
    "entity",
    "type",
    "id",
    "display_name",
    "birth_year",
    "death_year",
    "nationality",
    "gender",
    "cluster",
    "is_noise",
    "membership_probability",
    "outlier_score",
]


def run() -> None:
    artists = (
        pd.read_csv(
            ARTIST_CLUSTERS_PATH,

            dtype={
                "id": str,
                "entity": str,
            },
        )
        .sort_values(
            "artist_index"
        )
        .reset_index(
            drop=True
        )
    )

    coordinates_2d = np.load(
        UMAP_2D_COORDS_PATH
    )

    coordinates_3d = np.load(
        UMAP_3D_COORDS_PATH
    )

    if (
            len(artists)
            != len(coordinates_2d)
            or len(artists)
            != len(coordinates_3d)
    ):
        raise ValueError(
            "Artist clusters and "
            "UMAP coordinates are "
            "not aligned"
        )

    available_columns = [
        column
        for column in MAP_COLUMNS
        if column
           in artists.columns
    ]

    map_2d = artists[
        available_columns
    ].copy()

    map_2d["x"] = (
        coordinates_2d[:, 0]
    )

    map_2d["y"] = (
        coordinates_2d[:, 1]
    )

    map_2d.to_parquet(
        ARTIST_MAP_2D_PATH,
        index=False,
        compression="zstd",
    )

    map_2d.to_csv(
        ARTIST_MAP_2D_CSV_PATH,
        index=False,
    )

    map_3d = artists[
        available_columns
    ].copy()

    map_3d["x"] = (
        coordinates_3d[:, 0]
    )

    map_3d["y"] = (
        coordinates_3d[:, 1]
    )

    map_3d["z"] = (
        coordinates_3d[:, 2]
    )

    map_3d.to_parquet(
        ARTIST_MAP_3D_PATH,
        index=False,
        compression="zstd",
    )

    map_3d.to_csv(
        ARTIST_MAP_3D_CSV_PATH,
        index=False,
    )

    print(
        f"Saved 2D map to "
        f"{ARTIST_MAP_2D_PATH}"
    )

    print(
        f"Saved 3D map to "
        f"{ARTIST_MAP_3D_PATH}"
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()