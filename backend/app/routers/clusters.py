from fastapi import APIRouter, HTTPException

from app.ml.config import (
    CLUSTER_PROFILES_PATH,
    HDBSCAN_CANDIDATES_PATH,
    HDBSCAN_SUMMARY_PATH,
)
from app.ml.utils import read_json

router = APIRouter(prefix="/clusters", tags=["Artist clusters"])


@router.get("")
def get_clusters():
    if not HDBSCAN_SUMMARY_PATH.exists() or not CLUSTER_PROFILES_PATH.exists():
        raise HTTPException(status_code=404, detail="Cluster results not found")
    response = {
        "summary": read_json(HDBSCAN_SUMMARY_PATH),
        "profiles": read_json(CLUSTER_PROFILES_PATH),
    }
    if HDBSCAN_CANDIDATES_PATH.exists():
        import pandas as pd
        frame = pd.read_csv(HDBSCAN_CANDIDATES_PATH)
        response["candidates"] = frame.astype(object).where(pd.notna(frame), None).to_dict("records")
    return response


@router.get("/{cluster_id}")
def get_cluster(cluster_id: int):
    if not CLUSTER_PROFILES_PATH.exists():
        raise HTTPException(status_code=404, detail="Cluster profiles not found")
    profiles = read_json(CLUSTER_PROFILES_PATH).get("clusters", [])
    profile = next((item for item in profiles if item.get("cluster") == cluster_id), None)
    if profile is None:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return profile
