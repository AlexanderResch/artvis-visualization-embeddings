from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import normalize


@dataclass(frozen=True)
class RepresentationResult:
    data: np.ndarray
    input_mode: str
    original_dimension: int
    output_dimension: int
    explained_variance: float | None
    pca: PCA | None


def validate_embeddings(embeddings: np.ndarray) -> None:
    if embeddings.ndim != 2:
        raise ValueError(
            "Embeddings must be a two-dimensional array with shape "
            "(number_of_artists, embedding_dimension)."
        )
    if len(embeddings) < 3:
        raise ValueError("At least three Artist embeddings are required.")
    if not np.isfinite(embeddings).all():
        raise ValueError("Artist embeddings contain non-finite values.")


def l2_normalize_embeddings(embeddings: np.ndarray) -> np.ndarray:
    validate_embeddings(embeddings)
    return normalize(embeddings, norm="l2").astype(np.float32, copy=False)


def fit_pca_representation(
    normalized_embeddings: np.ndarray,
    variance_threshold: float,
    max_components: int,
    random_seed: int,
) -> RepresentationResult:
    if not 0.0 < variance_threshold <= 1.0:
        raise ValueError("variance_threshold must be in the interval (0, 1].")

    maximum = min(
        int(max_components),
        normalized_embeddings.shape[1],
        len(normalized_embeddings) - 1,
    )
    if maximum < 2:
        raise ValueError("PCA requires at least two available components.")

    initial = PCA(
        n_components=maximum,
        svd_solver="randomized",
        random_state=random_seed,
    )
    initial_transformed = initial.fit_transform(normalized_embeddings)
    cumulative = np.cumsum(initial.explained_variance_ratio_)
    selected = int(np.searchsorted(cumulative, variance_threshold) + 1)
    selected = min(max(selected, 2), maximum)

    if selected == maximum:
        pca = initial
        transformed = initial_transformed
    else:
        pca = PCA(
            n_components=selected,
            svd_solver="randomized",
            random_state=random_seed,
        )
        transformed = pca.fit_transform(normalized_embeddings)

    explained = float(np.sum(pca.explained_variance_ratio_))
    return RepresentationResult(
        data=transformed.astype(np.float32, copy=False),
        input_mode="pca",
        original_dimension=int(normalized_embeddings.shape[1]),
        output_dimension=int(transformed.shape[1]),
        explained_variance=explained,
        pca=pca,
    )


def build_representation(
    embeddings: np.ndarray,
    input_mode: str,
    variance_threshold: float,
    max_components: int,
    random_seed: int,
    pca_path: Path | None = None,
    fit_pca: bool = True,
) -> RepresentationResult:
    normalized = l2_normalize_embeddings(embeddings)
    mode = input_mode.strip().lower()

    if mode == "normalized":
        return RepresentationResult(
            data=normalized,
            input_mode="normalized",
            original_dimension=int(embeddings.shape[1]),
            output_dimension=int(normalized.shape[1]),
            explained_variance=None,
            pca=None,
        )

    if mode != "pca":
        raise ValueError(
            f"Unknown representation input mode '{input_mode}'. "
            "Use 'normalized' or 'pca'."
        )

    if fit_pca:
        result = fit_pca_representation(
            normalized_embeddings=normalized,
            variance_threshold=variance_threshold,
            max_components=max_components,
            random_seed=random_seed,
        )
        if pca_path is not None:
            pca_path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(result.pca, pca_path)
        return result

    if pca_path is None or not pca_path.exists():
        raise FileNotFoundError(
            "The shared PCA model is missing. Run the clustering step first "
            "or use UMAP_INPUT_MODE=normalized."
        )

    pca = joblib.load(pca_path)
    transformed = pca.transform(normalized).astype(np.float32, copy=False)
    explained = float(np.sum(getattr(pca, "explained_variance_ratio_", [])))
    return RepresentationResult(
        data=transformed,
        input_mode="pca",
        original_dimension=int(embeddings.shape[1]),
        output_dimension=int(transformed.shape[1]),
        explained_variance=explained,
        pca=pca,
    )
