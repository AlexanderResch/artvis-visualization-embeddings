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


def clean_display_names(
        artists: pd.DataFrame,
) -> pd.DataFrame:
    result = artists.copy()

    result["id"] = (
        result["id"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    result["entity"] = (
        result["entity"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    empty_entity_mask = (
        result["entity"]
        .eq("")
    )

    result.loc[
        empty_entity_mask,
        "entity",
    ] = (
            "Artist:"
            + result.loc[
                empty_entity_mask,
                "id",
            ]
    )

    if (
            "display_name"
            not in result.columns
    ):
        result["display_name"] = (
            result["entity"]
        )

        return result

    display_names = (
        result["display_name"]
        .astype("string")
        .str.strip()
    )

    normalized_names = (
        display_names
        .fillna("")
        .str.lower()
    )

    invalid_name_mask = (
            display_names.isna()
            | normalized_names.isin({
        "",
        "null",
        "none",
        "nan",
        "undefined",
    })
    )

    display_names = (
        display_names.mask(
            invalid_name_mask,
            result["entity"],
        )
    )

    result["display_name"] = (
        display_names
        .fillna(result["entity"])
        .astype(str)
    )

    return result


def run() -> None:
    if not ARTIST_CLUSTERS_PATH.exists():
        raise FileNotFoundError(
            "Missing Artist cluster file: "
            f"{ARTIST_CLUSTERS_PATH}"
        )

    if not UMAP_2D_COORDS_PATH.exists():
        raise FileNotFoundError(
            "Missing 2D UMAP coordinates: "
            f"{UMAP_2D_COORDS_PATH}"
        )

    if not UMAP_3D_COORDS_PATH.exists():
        raise FileNotFoundError(
            "Missing 3D UMAP coordinates: "
            f"{UMAP_3D_COORDS_PATH}"
        )

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

    artists = clean_display_names(
        artists
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
    ):
        raise ValueError(
            "Artist clusters and "
            "2D UMAP coordinates "
            "are not aligned"
        )

    if (
            len(artists)
            != len(coordinates_3d)
    ):
        raise ValueError(
            "Artist clusters and "
            "3D UMAP coordinates "
            "are not aligned"
        )

    if (
            coordinates_2d.ndim != 2
            or coordinates_2d.shape[1] != 2
    ):
        raise ValueError(
            "The 2D coordinate array "
            "must have shape (n, 2)"
        )

    if (
            coordinates_3d.ndim != 2
            or coordinates_3d.shape[1] != 3
    ):
        raise ValueError(
            "The 3D coordinate array "
            "must have shape (n, 3)"
        )

    available_columns = [
        column
        for column in MAP_COLUMNS
        if column in artists.columns
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

    missing_2d_names = int(
        map_2d[
            "display_name"
        ].isna().sum()
    )

    missing_3d_names = int(
        map_3d[
            "display_name"
        ].isna().sum()
    )

    print(
        f"Saved 2D map to "
        f"{ARTIST_MAP_2D_PATH}"
    )

    print(
        f"Saved 3D map to "
        f"{ARTIST_MAP_3D_PATH}"
    )

    print(
        "Missing display names "
        f"in 2D map: "
        f"{missing_2d_names}"
    )

    print(
        "Missing display names "
        f"in 3D map: "
        f"{missing_3d_names}"
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()