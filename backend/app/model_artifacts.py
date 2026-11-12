from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException

from app.ml.config import DATA_ROOT, MODEL_ROOT, SUPPORTED_MODELS
from app.ml.utils import read_json


@dataclass(frozen=True)
class ModelArtifacts:
    key: str
    name: str
    directory: Path
    input_directory: Path


CURRENT_MODEL: ContextVar[ModelArtifacts | None] = ContextVar("embedding_model", default=None)


def catalog():
    path = MODEL_ROOT / "manifest.json"
    return read_json(path) if path.exists() else {"default": "rotate", "models": {}}


def resolve_model(key=None):
    manifest = catalog()
    key = str(key or manifest["default"]).lower()
    if key not in SUPPORTED_MODELS:
        raise HTTPException(status_code=422, detail="Unknown embedding model.")
    entry = manifest["models"].get(key)
    if entry is None:
        raise HTTPException(status_code=503, detail=f"{SUPPORTED_MODELS[key]} data are not available. Extract the ML data release into the project directory.")
    directory = (MODEL_ROOT / key).resolve()
    input_directory = (DATA_ROOT / entry["input_directory"]).resolve()
    if not directory.is_relative_to(MODEL_ROOT.resolve()) or not input_directory.is_relative_to(DATA_ROOT.resolve()):
        raise HTTPException(status_code=500, detail="Invalid model artifact directory.")
    return ModelArtifacts(key, SUPPORTED_MODELS[key], directory, input_directory)


def current_artifacts():
    return CURRENT_MODEL.get() or resolve_model()


def artifact_path(filename):
    return current_artifacts().directory / filename


def input_path(filename):
    return current_artifacts().input_directory / filename


def available_models():
    manifest = catalog()
    models = []
    for key, name in SUPPORTED_MODELS.items():
        try:
            artifacts = resolve_model(key)
            ready = all((artifacts.directory / filename).exists() for filename in (
                "artist_embeddings.npy", "artist_clusters.parquet", "artist_map_2d.parquet",
                "artist_map_3d.parquet", "cluster_profiles.json", "hdbscan_summary.json",
            ))
        except HTTPException:
            ready = False
        entry = manifest["models"].get(key, {})
        model = {"id": key, "name": name, "available": ready}
        for field in ("rank", "evaluation"):
            if field in entry:
                model[field] = entry[field]
        models.append(model)
    models.sort(key=lambda model: model.get("rank", len(SUPPORTED_MODELS) + 1))
    return {"default": manifest["default"], "models": models}
