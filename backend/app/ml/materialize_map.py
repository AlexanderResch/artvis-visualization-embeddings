import numpy as np

from app.ml.config import (
    ARTIST_CLUSTERS_PATH, ARTIST_MAP_2D_PATH,
    ARTIST_MAP_3D_PATH, UMAP_2D_COORDS_PATH, UMAP_3D_COORDS_PATH,
)
from app.ml.utils import read_table

MAP_COLUMNS = [
    "artist_index", "entity", "type", "id", "display_name", "birth_year", "death_year",
    "nationality", "gender", "cluster", "is_noise", "membership_probability", "outlier_score",
]


def run():
    artists = read_table(ARTIST_CLUSTERS_PATH, dtype={"id": str, "entity": str})
    if not np.array_equal(artists.artist_index, np.arange(len(artists))):
        raise ValueError("Cluster rows must match the embedding and coordinate order.")
    names = artists["display_name"].astype("string").str.strip()
    invalid = names.isna() | names.str.lower().isin(["", "null", "none", "nan", "undefined"])
    artists["display_name"] = names.mask(invalid, artists["entity"])
    for dimensions, coords_path, parquet_path in (
        (2, UMAP_2D_COORDS_PATH, ARTIST_MAP_2D_PATH),
        (3, UMAP_3D_COORDS_PATH, ARTIST_MAP_3D_PATH),
    ):
        coordinates = np.load(coords_path)
        if coordinates.shape != (len(artists), dimensions) or not np.isfinite(coordinates).all():
            raise ValueError(f"{dimensions}D coordinates and artist rows are not aligned.")
        frame = artists[MAP_COLUMNS].copy()
        for index, column in enumerate(("x", "y", "z")[:dimensions]):
            frame[column] = coordinates[:, index]
        frame.to_parquet(parquet_path, index=False, compression="zstd")
    print(f"Materialized 2D and 3D maps for {len(artists):,} artists.", flush=True)


if __name__ == "__main__":
    run()
