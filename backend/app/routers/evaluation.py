from fastapi import APIRouter, HTTPException

from app.ml.config import (
    ATTRIBUTE_MANIFEST_PATH,
    EMBEDDING_SUMMARY_PATH,
    HDBSCAN_SUMMARY_PATH,
    LINK_EVALUATION_PATH,
    PREPARE_SUMMARY_PATH,
    PROJECTION_SUMMARY_PATH,
    SNAPSHOT_SUMMARY_PATH,
    TRAINING_EVALUATION_PATH,
    TRAINING_FINAL_PATH,
)
from app.ml.utils import read_json

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])


@router.get("")
def get_evaluation():
    paths = {
        "snapshot": SNAPSHOT_SUMMARY_PATH,
        "preparation": PREPARE_SUMMARY_PATH,
        "attributes": ATTRIBUTE_MANIFEST_PATH,
        "training_evaluation": TRAINING_EVALUATION_PATH,
        "training_final": TRAINING_FINAL_PATH,
        "link_prediction": LINK_EVALUATION_PATH,
        "embeddings": EMBEDDING_SUMMARY_PATH,
        "clustering": HDBSCAN_SUMMARY_PATH,
        "projection": PROJECTION_SUMMARY_PATH,
    }
    response = {name: read_json(path) for name, path in paths.items() if path.exists()}
    if not response:
        raise HTTPException(status_code=404, detail="No evaluation artifacts found")
    return response
