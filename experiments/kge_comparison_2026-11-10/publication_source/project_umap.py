"""Independent 2D/3D views of the representation used for clustering."""

import joblib
import numpy as np
from umap import UMAP
from sklearn.preprocessing import normalize

from app.ml.cluster_artists import load_embeddings
from app.ml.config import (
    ARTIST_EMBEDDINGS_PATH, HDBSCAN_PCA_PATH, HDBSCAN_SUMMARY_PATH,
    PROJECTION_SUMMARY_PATH, RANDOM_SEED, UMAP_2D_COORDS_PATH, UMAP_3D_COORDS_PATH,
    UMAP_MIN_DIST, UMAP_N_NEIGHBORS,
)
from app.ml.prepare_training_data import file_hash
from app.ml.utils import read_json, write_json


def run():
    embeddings = load_embeddings()
    summary = read_json(HDBSCAN_SUMMARY_PATH)
    current_hash = file_hash(ARTIST_EMBEDDINGS_PATH)
    if summary.get("embedding_sha256", current_hash) != current_hash:
        raise ValueError("Clustering and embeddings differ. Run clustering before projection.")
    use_pca = summary["input_mode"] == "pca"
    data = normalize(embeddings).astype(np.float32) if summary.get("l2_normalization") else embeddings
    if use_pca:
        if summary.get("embedding_sha256") != current_hash:
            raise ValueError("Run clustering on the current embeddings before projecting the shared PCA representation.")
        pca = joblib.load(HDBSCAN_PCA_PATH)
        data = pca.transform(data).astype(np.float32)
    neighbors = min(UMAP_N_NEIGHBORS, len(embeddings) - 1)
    for dimensions, path in ((2, UMAP_2D_COORDS_PATH), (3, UMAP_3D_COORDS_PATH)):
        coordinates = UMAP(
            n_components=dimensions, n_neighbors=neighbors, min_dist=UMAP_MIN_DIST,
            metric="euclidean", random_state=RANDOM_SEED, n_jobs=1,
        ).fit_transform(data)
        if not np.isfinite(coordinates).all():
            raise ValueError("UMAP produced non-finite coordinates.")
        np.save(path, coordinates.astype(np.float32))
        print(f"Saved {dimensions}D UMAP for {len(embeddings):,} artists.", flush=True)
    write_json(PROJECTION_SUMMARY_PATH, {
        "embedding_model": summary.get("embedding_model"),
        "l2_normalization": bool(summary.get("l2_normalization")),
        "artist_count": len(embeddings), "embedding_dimension": embeddings.shape[1],
        "input_mode": "pca" if use_pca else "raw", "projection_input_dimension": data.shape[1],
        "metric": "euclidean", "n_neighbors": neighbors,
        "min_dist": UMAP_MIN_DIST, "random_seed": RANDOM_SEED,
        "note": "Independent 2D/3D projections for display. HDBSCAN does not use these coordinates.",
    })


if __name__ == "__main__":
    run()
