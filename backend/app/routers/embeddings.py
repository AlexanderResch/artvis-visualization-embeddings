import os
import pandas as pd
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/embeddings", tags=["embeddings"])

BASE_PATH = "app/ml/data"


@router.get("/2d")
def get_embeddings_2d():
    path = os.path.join(BASE_PATH, "embedding_2d.csv")

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="2D embeddings not found")

    df = pd.read_csv(path)
    return df.to_dict(orient="records")


@router.get("/3d")
def get_embeddings_3d():
    path = os.path.join(BASE_PATH, "embedding_3d.csv")

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="3D embeddings not found")

    df = pd.read_csv(path)
    return df.to_dict(orient="records")