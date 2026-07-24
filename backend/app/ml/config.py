import os
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

def _neo4j_credentials() -> tuple[str, str]:
    auth_value = os.getenv(
        "NEO4J_AUTH",
        "",
    ).strip()

    auth_user = ""
    auth_password = ""

    if "/" in auth_value:
        auth_user, auth_password = auth_value.split(
            "/",
            1,
        )

    user = (
            os.getenv("NEO4J_USER", "").strip()
            or auth_user
            or "neo4j"
    )

    password = (
            os.getenv("NEO4J_PASSWORD", "").strip()
            or auth_password
    )

    if not password:
        raise RuntimeError(
            "Neo4j credentials are missing. Set NEO4J_AUTH or "
            "NEO4J_USER and NEO4J_PASSWORD."
        )

    return user, password


NEO4J_URI = os.getenv(
    "NEO4J_URI",
    "bolt://artvis-db:7687",
)

NEO4J_USER, NEO4J_PASSWORD = _neo4j_credentials()

NEO4J_DATABASE = os.getenv(
    "NEO4J_DATABASE",
) or None

NEO4J_FETCH_SIZE = int(
    os.getenv(
        "NEO4J_FETCH_SIZE",
        "5000",
    )
)

EXPORT_BATCH_SIZE = int(
    os.getenv(
        "EXPORT_BATCH_SIZE",
        "50000",
    )
)

RANDOM_SEED = int(
    os.getenv(
        "ML_RANDOM_SEED",
        "42",
    )
)

MODEL_NODE_TYPES = [
    "Artist",
    "Exhibition",
    "Geoname",
    "Group",
    "Item",
    "Location",
    "Organizer",
    "Venue",
]

DISPLAY_NAME_PROPERTIES = {
    "Artist": "sortname",
    "Exhibition": "title",
    "Geoname": "name",
    "Group": "name",
    "Item": "title",
    "Location": "name",
    "Organizer": "name",
    "Venue": "name",
}

NODES_PATH = DATA_DIR / "nodes.parquet"
EDGES_PATH = DATA_DIR / "edges.parquet"

SNAPSHOT_SUMMARY_PATH = (
        DATA_DIR / "snapshot_summary.json"
)

ENTITY_METADATA_PATH = (
        DATA_DIR / "entity_metadata.parquet"
)

ATTRIBUTE_FEATURES_PATH = (
        DATA_DIR / "attribute_features.npy"
)

ATTRIBUTE_MANIFEST_PATH = (
        DATA_DIR / "attribute_manifest.json"
)

INDEXED_EDGES_PATH = (
        DATA_DIR / "indexed_edges.parquet"
)

RELATION_DIR = DATA_DIR / "relations"

RELATION_MANIFEST_PATH = (
        DATA_DIR / "relation_manifest.json"
)

TYPE_ENTITIES_PATH = (
        DATA_DIR / "type_entities.npz"
)

TYPE_IDS_PATH = (
        DATA_DIR / "entity_type_ids.npy"
)

PREPARE_SUMMARY_PATH = (
        DATA_DIR / "prepare_summary.json"
)

ATTRIBUTE_DIM = int(
    os.getenv(
        "ATTRIBUTE_DIM",
        "128",
    )
)

ATTRIBUTE_MAX_STRING_LENGTH = int(
    os.getenv(
        "ATTRIBUTE_MAX_STRING_LENGTH",
        "100",
    )
)

ATTRIBUTE_MAX_LIST_ITEMS = int(
    os.getenv(
        "ATTRIBUTE_MAX_LIST_ITEMS",
        "20",
    )
)

ATTRIBUTE_MAX_CARDINALITY = int(
    os.getenv(
        "ATTRIBUTE_MAX_CARDINALITY",
        "500",
    )
)

ATTRIBUTE_MAX_CARDINALITY_RATIO = float(
    os.getenv(
        "ATTRIBUTE_MAX_CARDINALITY_RATIO",
        "0.05",
    )
)

ATTRIBUTE_MIN_CATEGORY_FREQUENCY = int(
    os.getenv(
        "ATTRIBUTE_MIN_CATEGORY_FREQUENCY",
        "2",
    )
)

ATTRIBUTE_EXCLUDED_KEYS = {
    value.strip().lower()
    for value in os.getenv(
        "ATTRIBUTE_EXCLUDED_KEYS",
        (
            "id,name,title,sortname,url,uri,website,"
            "source,sourceurl,createdat,updatedat,status"
        ),
    ).split(",")
    if value.strip()
}

TRAIN_RATIO = float(
    os.getenv(
        "TRAIN_RATIO",
        "0.80",
    )
)

VALIDATION_RATIO = float(
    os.getenv(
        "VALIDATION_RATIO",
        "0.10",
    )
)

TEST_RATIO = float(
    os.getenv(
        "TEST_RATIO",
        "0.10",
    )
)

COMPLEX_DIM = int(
    os.getenv(
        "COMPLEX_DIM",
        "64",
    )
)

ATTRIBUTE_HIDDEN_DIM = int(
    os.getenv(
        "ATTRIBUTE_HIDDEN_DIM",
        "128",
    )
)

MODEL_DROPOUT = float(
    os.getenv(
        "MODEL_DROPOUT",
        "0.10",
    )
)

TRAIN_EPOCHS = int(
    os.getenv(
        "TRAIN_EPOCHS",
        "40",
    )
)

FINAL_TRAIN_EPOCHS = int(
    os.getenv(
        "FINAL_TRAIN_EPOCHS",
        str(TRAIN_EPOCHS),
    )
)

TRAIN_BATCH_SIZE = int(
    os.getenv(
        "TRAIN_BATCH_SIZE",
        "2048",
    )
)

NEGATIVES_PER_POSITIVE = int(
    os.getenv(
        "NEGATIVES_PER_POSITIVE",
        "1",
    )
)

LEARNING_RATE = float(
    os.getenv(
        "LEARNING_RATE",
        "0.001",
    )
)

WEIGHT_DECAY = float(
    os.getenv(
        "WEIGHT_DECAY",
        "0.00001",
    )
)

RELATION_EPOCH_CAP = int(
    os.getenv(
        "RELATION_EPOCH_CAP",
        "250000",
    )
)

VALIDATION_POSITIVES_PER_RELATION = int(
    os.getenv(
        "VALIDATION_POSITIVES_PER_RELATION",
        "5000",
    )
)

EVALUATION_POSITIVES_PER_RELATION = int(
    os.getenv(
        "EVALUATION_POSITIVES_PER_RELATION",
        "2000",
    )
)

EVALUATION_RANKING_NEGATIVES = int(
    os.getenv(
        "EVALUATION_RANKING_NEGATIVES",
        "100",
    )
)

EARLY_STOPPING_PATIENCE = int(
    os.getenv(
        "EARLY_STOPPING_PATIENCE",
        "5",
    )
)

DEVICE = os.getenv(
    "ML_DEVICE",
    "auto",
)

TORCH_NUM_THREADS = int(
    os.getenv(
        "TORCH_NUM_THREADS",
        "8",
    )
)

EVALUATION_CHECKPOINT_PATH = (
        DATA_DIR / "attribute_complex_evaluation.pt"
)

FINAL_CHECKPOINT_PATH = (
        DATA_DIR / "attribute_complex_final.pt"
)

TRAINING_EVALUATION_PATH = (
        DATA_DIR / "training_evaluation.json"
)

TRAINING_FINAL_PATH = (
        DATA_DIR / "training_final.json"
)

LINK_EVALUATION_PATH = (
        DATA_DIR / "link_evaluation.json"
)

ENTITY_EMBEDDINGS_PATH = (
        DATA_DIR / "entity_embeddings.npy"
)

ENTITY_IDS_PATH = (
        DATA_DIR / "entity_ids.tsv"
)

ARTIST_EMBEDDINGS_PATH = (
        DATA_DIR / "artist_embeddings.npy"
)

ARTIST_METADATA_PATH = (
        DATA_DIR / "artist_metadata.csv"
)

EMBEDDING_SUMMARY_PATH = (
        DATA_DIR / "embedding_summary.json"
)

EMBEDDING_BATCH_SIZE = int(
    os.getenv(
        "EMBEDDING_BATCH_SIZE",
        "8192",
    )
)

ARTIST_CLUSTERS_PATH = (
        DATA_DIR / "artist_clusters.csv"
)

HDBSCAN_MODEL_PATH = (
        DATA_DIR / "artist_hdbscan.joblib"
)

HDBSCAN_PCA_PATH = (
        DATA_DIR / "artist_hdbscan_pca.joblib"
)

HDBSCAN_CANDIDATES_PATH = (
        DATA_DIR / "hdbscan_candidates.csv"
)

HDBSCAN_SUMMARY_PATH = (
        DATA_DIR / "hdbscan_summary.json"
)

HDBSCAN_MIN_CLUSTER_SIZES = tuple(
    sorted(
        {
            int(value.strip())
            for value in os.getenv(
            "HDBSCAN_MIN_CLUSTER_SIZES",
            "20,50,100,200",
        ).split(",")
            if value.strip()
        }
    )
)

HDBSCAN_MIN_SAMPLES_VALUES = tuple(
    sorted(
        {
            int(value.strip())
            for value in os.getenv(
            "HDBSCAN_MIN_SAMPLES_VALUES",
            "5,10,20",
        ).split(",")
            if value.strip()
        }
    )
)

HDBSCAN_MAX_NOISE_FRACTION = float(
    os.getenv(
        "HDBSCAN_MAX_NOISE_FRACTION",
        "0.80",
    )
)

HDBSCAN_PCA_VARIANCE = float(
    os.getenv(
        "HDBSCAN_PCA_VARIANCE",
        "0.95",
    )
)

HDBSCAN_PCA_MAX_COMPONENTS = int(
    os.getenv(
        "HDBSCAN_PCA_MAX_COMPONENTS",
        "50",
    )
)

SILHOUETTE_SAMPLE_SIZE = int(
    os.getenv(
        "SILHOUETTE_SAMPLE_SIZE",
        "5000",
    )
)

UMAP_N_NEIGHBORS = int(
    os.getenv(
        "UMAP_N_NEIGHBORS",
        "30",
    )
)

UMAP_MIN_DIST = float(
    os.getenv(
        "UMAP_MIN_DIST",
        "0.10",
    )
)

UMAP_METRIC = os.getenv(
    "UMAP_METRIC",
    "cosine",
)

UMAP_2D_MODEL_PATH = (
        DATA_DIR / "artist_umap_2d.joblib"
)

UMAP_3D_MODEL_PATH = (
        DATA_DIR / "artist_umap_3d.joblib"
)

UMAP_2D_COORDS_PATH = (
        DATA_DIR / "artist_umap_2d.npy"
)

UMAP_3D_COORDS_PATH = (
        DATA_DIR / "artist_umap_3d.npy"
)

PROJECTION_SUMMARY_PATH = (
        DATA_DIR / "projection_summary.json"
)

ARTIST_MAP_2D_PATH = (
        DATA_DIR / "artist_map_2d.parquet"
)

ARTIST_MAP_3D_PATH = (
        DATA_DIR / "artist_map_3d.parquet"
)

ARTIST_MAP_2D_CSV_PATH = (
        DATA_DIR / "artist_map_2d.csv"
)

ARTIST_MAP_3D_CSV_PATH = (
        DATA_DIR / "artist_map_3d.csv"
)

CLUSTER_PROFILES_PATH = (
        DATA_DIR / "cluster_profiles.json"
)