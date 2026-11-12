"""Pipeline settings and the artifact paths consumed by the API."""

import os
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("ML_DATA_DIR", str(ML_DIR / "data")))
INPUT_DATA_DIR = Path(os.getenv("ML_INPUT_DIR", str(DATA_DIR)))
RANDOM_SEED = int(os.getenv("ML_RANDOM_SEED", "43"))
SUPPORTED_MODELS = {name.lower(): name for name in ("TransE", "DistMult", "ComplEx", "RotatE")}
try:
    KGE_MODEL = SUPPORTED_MODELS[os.getenv("KGE_MODEL", "TransE").lower()]
except KeyError as error:
    raise ValueError("KGE_MODEL must be TransE, DistMult, ComplEx, or RotatE.") from error
MODEL_NODE_TYPES = (
    "Artist", "Exhibition", "Geoname", "Group", "Item", "Location", "Organizer", "Venue",
)
DISPLAY_NAME_PROPERTIES = {
    "Artist": "sortname", "Exhibition": "title", "Item": "title",
}

# The retained co-exhibition signal was selected in the documented offline comparison.
INCLUDE_COEXHIBITIONS = os.getenv("INCLUDE_COEXHIBITIONS", "true").lower() == "true"
EXCLUDED_RELATIONS = () if INCLUDE_COEXHIBITIONS else ("CO_EXHIBITED",)
# Count exported real features consistently across real and complex models.
EMBEDDING_DIM = int(os.getenv("KGE_EMBEDDING_DIM", os.getenv("TRANSE_EMBEDDING_DIM", "64")))
if EMBEDDING_DIM < 2 or (KGE_MODEL in {"ComplEx", "RotatE"} and EMBEDDING_DIM % 2):
    raise ValueError("KGE_EMBEDDING_DIM must be at least two and even for complex models.")
TRAIN_EPOCHS = int(os.getenv("TRAIN_EPOCHS", "2"))
TRAIN_BATCH_SIZE = int(os.getenv("TRAIN_BATCH_SIZE", "2048"))
LEARNING_RATE = float(os.getenv("LEARNING_RATE", "0.001"))
ADAM_FUSED = os.getenv("ADAM_FUSED", "false").lower() == "true"
NEGATIVES_PER_POSITIVE = int(os.getenv("NEGATIVES_PER_POSITIVE", "1"))
NEGATIVE_SAMPLER = os.getenv("NEGATIVE_SAMPLER", "pseudo_typed")
if NEGATIVE_SAMPLER not in {"basic", "pseudo_typed"}:
    raise ValueError("NEGATIVE_SAMPLER must be 'basic' or 'pseudo_typed'.")
TORCH_NUM_THREADS = int(os.getenv("TORCH_NUM_THREADS", "4"))
DEVICE = os.getenv("ML_DEVICE", "auto")
HDBSCAN_MIN_CLUSTER_SIZE = int(os.getenv("HDBSCAN_MIN_CLUSTER_SIZE", "50"))
HDBSCAN_MIN_SAMPLES = int(os.getenv("HDBSCAN_MIN_SAMPLES", "5"))
HDBSCAN_CLUSTER_SELECTION_METHOD = os.getenv("HDBSCAN_CLUSTER_SELECTION_METHOD", "eom")
if HDBSCAN_CLUSTER_SELECTION_METHOD not in {"eom", "leaf"}:
    raise ValueError("HDBSCAN_CLUSTER_SELECTION_METHOD must be 'eom' or 'leaf'.")
USE_PCA = os.getenv("HDBSCAN_USE_PCA", "false").lower() == "true"
PCA_COMPONENTS = int(os.getenv("HDBSCAN_PCA_COMPONENTS", "10"))
PCA_VARIANCE = 0.95
UMAP_N_NEIGHBORS = int(os.getenv("UMAP_N_NEIGHBORS", "30"))
UMAP_MIN_DIST = float(os.getenv("UMAP_MIN_DIST", "0.10"))

NODES_PATH = INPUT_DATA_DIR / "nodes.parquet"
EDGES_PATH = INPUT_DATA_DIR / "edges.parquet"
SNAPSHOT_SUMMARY_PATH = INPUT_DATA_DIR / "snapshot_summary.json"
ENTITY_METADATA_PATH = INPUT_DATA_DIR / "entity_metadata.parquet"
INDEXED_EDGES_PATH = INPUT_DATA_DIR / "indexed_edges.parquet"
PREPARE_SUMMARY_PATH = INPUT_DATA_DIR / "prepare_summary.json"
TRIPLES_PATH = INPUT_DATA_DIR / "triples.npy"
RELATION_MAPPING_PATH = INPUT_DATA_DIR / "relation_mapping.json"
FINAL_CHECKPOINT_PATH = DATA_DIR / f"{KGE_MODEL.lower()}.pt"
TRAINING_FINAL_PATH = DATA_DIR / "training_final.json"
ARTIST_EMBEDDINGS_PATH = DATA_DIR / "artist_embeddings.npy"
ARTIST_METADATA_PATH = DATA_DIR / "artist_metadata.csv"
EMBEDDING_SUMMARY_PATH = DATA_DIR / "embedding_summary.json"
ARTIST_CLUSTERS_PATH = DATA_DIR / "artist_clusters.csv"
HDBSCAN_MODEL_PATH = DATA_DIR / "artist_hdbscan.joblib"
HDBSCAN_PCA_PATH = DATA_DIR / "artist_hdbscan_pca.joblib"
HDBSCAN_SUMMARY_PATH = DATA_DIR / "hdbscan_summary.json"
PCA_COMPARISON_PATH = DATA_DIR / "pca_comparison.json"
UMAP_2D_COORDS_PATH = DATA_DIR / "artist_umap_2d.npy"
UMAP_3D_COORDS_PATH = DATA_DIR / "artist_umap_3d.npy"
PROJECTION_SUMMARY_PATH = DATA_DIR / "projection_summary.json"
ARTIST_MAP_2D_PATH = DATA_DIR / "artist_map_2d.parquet"
ARTIST_MAP_3D_PATH = DATA_DIR / "artist_map_3d.parquet"
ARTIST_MAP_2D_CSV_PATH = DATA_DIR / "artist_map_2d.csv"
ARTIST_MAP_3D_CSV_PATH = DATA_DIR / "artist_map_3d.csv"
CLUSTER_PROFILES_PATH = DATA_DIR / "cluster_profiles.json"
