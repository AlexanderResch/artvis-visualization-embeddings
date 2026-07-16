import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import duckdb
import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction import FeatureHasher

from app.ml.config import (
    ATTRIBUTE_DIM,
    ATTRIBUTE_EXCLUDED_KEYS,
    ATTRIBUTE_FEATURES_PATH,
    ATTRIBUTE_MANIFEST_PATH,
    ATTRIBUTE_MAX_CARDINALITY,
    ATTRIBUTE_MAX_CARDINALITY_RATIO,
    ATTRIBUTE_MAX_LIST_ITEMS,
    ATTRIBUTE_MAX_STRING_LENGTH,
    ATTRIBUTE_MIN_CATEGORY_FREQUENCY,
    EDGES_PATH,
    ENTITY_METADATA_PATH,
    INDEXED_EDGES_PATH,
    MODEL_NODE_TYPES,
    NODES_PATH,
    PREPARE_SUMMARY_PATH,
    RANDOM_SEED,
    RELATION_DIR,
    RELATION_MANIFEST_PATH,
    TEST_RATIO,
    TRAIN_RATIO,
    TYPE_ENTITIES_PATH,
    TYPE_IDS_PATH,
    VALIDATION_RATIO,
)
from app.ml.utils import (
    display_name,
    edge_key,
    first_value,
    parse_year,
    slugify,
    write_json,
)


def _load_properties(text: str) -> dict[str, Any]:
    try:
        value = json.loads(text or "{}")
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        return {}


def _is_excluded_key(key: str) -> bool:
    key_lower = key.lower()
    if key_lower in ATTRIBUTE_EXCLUDED_KEYS:
        return True

    # Technical identifiers or provenance fields are stored in the snapshot,
    # but they are not useful semantic input for the embedding model.
    technical_fragments = (
        "url",
        "uri",
        "source",
        "timestamp",
        "created",
        "updated",
        "identifier",
        "uuid",
        "hash",
    )
    return any(fragment in key_lower for fragment in technical_fragments)


def _numeric_value(key: str, value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float, np.integer, np.floating)):
        number = float(value)
        return number if math.isfinite(number) else None

    text = str(value).strip()
    if not text:
        return None

    if any(fragment in key.lower() for fragment in ("year", "date", "time")):
        year = parse_year(text)
        return None if year is None else float(year)

    try:
        number = float(text)
        return number if math.isfinite(number) else None
    except ValueError:
        return None


def _categorical_values(value: Any) -> list[str]:
    if value is None or isinstance(value, bool):
        return []

    raw_values = (
        list(value)[:ATTRIBUTE_MAX_LIST_ITEMS]
        if isinstance(value, (list, tuple, set))
        else [value]
    )

    result: list[str] = []
    for item in raw_values:
        text = str(item).strip()
        if text and len(text) <= ATTRIBUTE_MAX_STRING_LENGTH:
            result.append(text)
    return result


def _build_metadata(
        nodes: pd.DataFrame,
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    nodes = nodes.loc[nodes["type"].isin(MODEL_NODE_TYPES)].copy()
    nodes = nodes.drop_duplicates(subset=["entity"], keep="first")
    nodes = nodes.sort_values(["type", "entity"]).reset_index(drop=True)
    properties_list = [_load_properties(text) for text in nodes["properties_json"]]

    rows: list[dict[str, Any]] = []
    for global_index, (record, properties) in enumerate(
            zip(nodes.to_dict("records"), properties_list, strict=True)
    ):
        entity = str(record["entity"])
        node_type = str(record["type"])

        nationality_value = first_value(
            properties,
            ("nationality", "nation", "country", "countryCode"),
        )
        gender_value = first_value(properties, ("gender", "sex"))

        rows.append(
            {
                "global_index": global_index,
                "entity": entity,
                "type": node_type,
                "id": None if pd.isna(record.get("id")) else str(record.get("id")),
                "element_id": str(record["element_id"]),
                "display_name": display_name(node_type, properties, entity),
                "birth_year": parse_year(
                    first_value(
                        properties,
                        ("birthyear", "birthYear", "birth_year", "birthdate"),
                    )
                ),
                "death_year": parse_year(
                    first_value(
                        properties,
                        ("deathyear", "deathYear", "death_year", "deathdate"),
                    )
                ),
                "nationality": (
                    None if nationality_value is None else str(nationality_value)
                ),
                "gender": None if gender_value is None else str(gender_value),
                "properties_json": record["properties_json"],
            }
        )

    metadata = pd.DataFrame(rows)
    type_to_id = {node_type: index for index, node_type in enumerate(MODEL_NODE_TYPES)}
    type_ids = metadata["type"].map(type_to_id).astype(np.int16).to_numpy()
    np.save(TYPE_IDS_PATH, type_ids)
    metadata.to_parquet(ENTITY_METADATA_PATH, index=False, compression="zstd")
    return metadata, properties_list


def _numeric_statistics(
        metadata: pd.DataFrame,
        properties_list: list[dict[str, Any]],
) -> dict[str, dict[str, float]]:
    accumulators: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])

    for node_type, properties in zip(metadata["type"], properties_list, strict=True):
        for key, value in properties.items():
            if _is_excluded_key(key):
                continue

            number = _numeric_value(key, value)
            if number is None:
                continue

            stat_key = f"{node_type}.{key}"
            accumulator = accumulators[stat_key]
            accumulator[0] += 1.0
            accumulator[1] += number
            accumulator[2] += number * number

    statistics: dict[str, dict[str, float]] = {}
    for stat_key, (count, total, total_square) in accumulators.items():
        mean = total / count
        variance = max(total_square / count - mean * mean, 0.0)
        statistics[stat_key] = {
            "count": int(count),
            "mean": mean,
            "std": math.sqrt(variance) or 1.0,
        }
    return statistics


def _categorical_statistics(
        metadata: pd.DataFrame,
        properties_list: list[dict[str, Any]],
) -> tuple[dict[str, set[str]], dict[str, dict[str, Any]]]:
    value_counts: dict[str, Counter[str]] = defaultdict(Counter)
    observation_counts: Counter[str] = Counter()
    overflowed_keys: set[str] = set()

    for node_type, properties in zip(metadata["type"], properties_list, strict=True):
        for key, value in properties.items():
            if _is_excluded_key(key) or isinstance(value, bool):
                continue
            if _numeric_value(key, value) is not None:
                continue

            stat_key = f"{node_type}.{key}"
            values = _categorical_values(value)
            if not values:
                continue

            observation_counts[stat_key] += len(values)
            if stat_key in overflowed_keys:
                continue

            counter = value_counts[stat_key]
            counter.update(values)
            if len(counter) > ATTRIBUTE_MAX_CARDINALITY:
                overflowed_keys.add(stat_key)
                value_counts.pop(stat_key, None)

    accepted_values: dict[str, set[str]] = {}
    manifest: dict[str, dict[str, Any]] = {}

    for stat_key, counter in value_counts.items():
        observed = int(observation_counts[stat_key])
        cardinality = len(counter)
        cardinality_ratio = cardinality / observed if observed else 1.0

        if cardinality > ATTRIBUTE_MAX_CARDINALITY:
            continue
        if cardinality_ratio > ATTRIBUTE_MAX_CARDINALITY_RATIO:
            continue

        values = {
            value
            for value, frequency in counter.items()
            if frequency >= ATTRIBUTE_MIN_CATEGORY_FREQUENCY
        }
        if not values:
            continue

        accepted_values[stat_key] = values
        manifest[stat_key] = {
            "observations": observed,
            "cardinality": cardinality,
            "cardinality_ratio": cardinality_ratio,
            "accepted_value_count": len(values),
        }

    for stat_key in overflowed_keys:
        manifest[stat_key] = {
            "excluded": True,
            "reason": "cardinality_above_limit",
        }

    return accepted_values, manifest


def _feature_dict(
        node_type: str,
        properties: dict[str, Any],
        numeric_statistics: dict[str, dict[str, float]],
        accepted_categorical_values: dict[str, set[str]],
) -> dict[str, float]:
    features: dict[str, float] = {}
    present_numeric: set[str] = set()
    present_categorical: set[str] = set()

    for key, value in properties.items():
        if _is_excluded_key(key) or value is None:
            continue

        stat_key = f"{node_type}.{key}"
        number = _numeric_value(key, value)
        if number is not None and stat_key in numeric_statistics:
            stats = numeric_statistics[stat_key]
            standardized = (number - stats["mean"]) / stats["std"]
            features[f"num:{stat_key}"] = float(np.clip(standardized, -10.0, 10.0))
            present_numeric.add(stat_key)
            continue

        if isinstance(value, bool):
            features[f"bool:{stat_key}={str(value).lower()}"] = 1.0
            continue

        allowed_values = accepted_categorical_values.get(stat_key)
        if not allowed_values:
            continue

        for text in _categorical_values(value):
            if text in allowed_values:
                features[f"cat:{stat_key}={text}"] = 1.0
                present_categorical.add(stat_key)

    for stat_key in numeric_statistics:
        if stat_key.startswith(f"{node_type}.") and stat_key not in present_numeric:
            features[f"missing_numeric:{stat_key}"] = 1.0

    for stat_key in accepted_categorical_values:
        if stat_key.startswith(f"{node_type}.") and stat_key not in present_categorical:
            features[f"missing_categorical:{stat_key}"] = 1.0

    return features


def _build_attribute_features(
        metadata: pd.DataFrame,
        properties_list: list[dict[str, Any]],
) -> dict[str, Any]:
    numeric_statistics = _numeric_statistics(metadata, properties_list)
    accepted_categorical_values, categorical_manifest = _categorical_statistics(
        metadata,
        properties_list,
    )

    hasher = FeatureHasher(
        n_features=ATTRIBUTE_DIM,
        input_type="dict",
        alternate_sign=False,
        dtype=np.float32,
    )

    feature_rows = [
        _feature_dict(
            node_type,
            properties,
            numeric_statistics,
            accepted_categorical_values,
        )
        for node_type, properties in zip(
            metadata["type"],
            properties_list,
            strict=True,
        )
    ]

    matrix = hasher.transform(feature_rows).toarray().astype(np.float32, copy=False)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    matrix = matrix / np.maximum(norms, 1.0)
    np.save(ATTRIBUTE_FEATURES_PATH, matrix)

    zero_feature_rows = int(np.count_nonzero(np.linalg.norm(matrix, axis=1) == 0.0))
    manifest = {
        "feature_dimension": ATTRIBUTE_DIM,
        "method": (
            "FeatureHasher over standardized numeric literals, missing-value "
            "indicators, booleans and low-cardinality categorical literals"
        ),
        "excluded_keys": sorted(ATTRIBUTE_EXCLUDED_KEYS),
        "numeric_statistics": numeric_statistics,
        "categorical_statistics": categorical_manifest,
        "categorical_limits": {
            "maximum_cardinality": ATTRIBUTE_MAX_CARDINALITY,
            "maximum_cardinality_ratio": ATTRIBUTE_MAX_CARDINALITY_RATIO,
            "minimum_value_frequency": ATTRIBUTE_MIN_CATEGORY_FREQUENCY,
        },
        "identity_and_display_text_excluded_from_training": True,
        "entity_count": len(metadata),
        "zero_feature_rows": zero_feature_rows,
    }
    write_json(ATTRIBUTE_MANIFEST_PATH, manifest)
    return manifest


def _sql_path(path: Path) -> str:
    return str(path.resolve()).replace("'", "''")


def _create_indexed_edges() -> None:
    connection = duckdb.connect()
    try:
        nodes_path = _sql_path(ENTITY_METADATA_PATH)
        edges_path = _sql_path(EDGES_PATH)
        output_path = _sql_path(INDEXED_EDGES_PATH)

        # Every raw edge remains in edges.parquet. For model training, identical
        # triples are deduplicated. CO_EXHIBITED is treated as one undirected pair.
        connection.execute(
            f"""
            COPY (
                WITH joined AS (
                    SELECT
                        source.global_index AS head,
                        edge.source_type,
                        edge.relation,
                        edge.target_type,
                        target.global_index AS tail
                    FROM read_parquet('{edges_path}') AS edge
                    INNER JOIN read_parquet('{nodes_path}') AS source
                        ON edge.source_entity = source.entity
                    INNER JOIN read_parquet('{nodes_path}') AS target
                        ON edge.target_entity = target.entity
                ),
                ordinary AS (
                    SELECT DISTINCT
                        head,
                        source_type,
                        relation,
                        target_type,
                        tail
                    FROM joined
                    WHERE relation <> 'CO_EXHIBITED'
                ),
                co_exhibited AS (
                    SELECT DISTINCT
                        LEAST(head, tail) AS head,
                        'Artist' AS source_type,
                        'CO_EXHIBITED' AS relation,
                        'Artist' AS target_type,
                        GREATEST(head, tail) AS tail
                    FROM joined
                    WHERE relation = 'CO_EXHIBITED'
                      AND source_type = 'Artist'
                      AND target_type = 'Artist'
                      AND head <> tail
                )
                SELECT * FROM ordinary
                UNION ALL
                SELECT * FROM co_exhibited
            ) TO '{output_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
            """
        )
    finally:
        connection.close()


def _relation_file_name(key: str) -> str:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
    return f"{slugify(key)}_{digest}"


def _validate_split_ratios() -> None:
    values = (TRAIN_RATIO, VALIDATION_RATIO, TEST_RATIO)
    if any(value < 0.0 for value in values):
        raise ValueError("Train, validation and test ratios must be non-negative")
    if not math.isclose(sum(values), 1.0, rel_tol=0.0, abs_tol=1e-9):
        raise ValueError("TRAIN_RATIO + VALIDATION_RATIO + TEST_RATIO must equal 1.0")


def _split_indices(
        count: int,
        relation_id: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(RANDOM_SEED + relation_id)
    permutation = rng.permutation(count).astype(np.int64)

    validation_count = int(count * VALIDATION_RATIO)
    test_count = int(count * TEST_RATIO)
    if count >= 10:
        validation_count = max(validation_count, 1)
        test_count = max(test_count, 1)

    train_count = count - validation_count - test_count
    if train_count <= 0:
        train_count = max(count - 2, 1)
        remaining = count - train_count
        validation_count = 1 if remaining >= 2 else 0
        test_count = remaining - validation_count

    train = permutation[:train_count]
    validation = permutation[train_count : train_count + validation_count]
    test = permutation[train_count + validation_count :]
    return train, validation, test


def _prepare_relations(metadata: pd.DataFrame) -> list[dict[str, Any]]:
    _validate_split_ratios()
    RELATION_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in RELATION_DIR.glob("*"):
        if old_file.is_file():
            old_file.unlink()

    type_entities: dict[str, np.ndarray] = {}
    global_to_local = np.full(len(metadata), -1, dtype=np.int32)

    for node_type in MODEL_NODE_TYPES:
        global_indices = metadata.loc[
            metadata["type"] == node_type,
            "global_index",
        ].to_numpy(dtype=np.int64)
        type_entities[node_type] = global_indices
        global_to_local[global_indices] = np.arange(len(global_indices), dtype=np.int32)

    np.savez_compressed(
        TYPE_ENTITIES_PATH,
        **type_entities,
        global_to_local=global_to_local,
    )

    connection = duckdb.connect()
    relation_manifest: list[dict[str, Any]] = []
    try:
        indexed_path = _sql_path(INDEXED_EDGES_PATH)
        groups = connection.execute(
            f"""
            SELECT source_type, relation, target_type, COUNT(*) AS edge_count
            FROM read_parquet('{indexed_path}')
            GROUP BY source_type, relation, target_type
            ORDER BY relation, source_type, target_type
            """
        ).fetchall()

        for relation_id, (source_type, relation, target_type, edge_count) in enumerate(groups):
            key = edge_key(source_type, relation, target_type)
            file_stem = _relation_file_name(key)
            arrays = connection.execute(
                f"""
                SELECT head, tail
                FROM read_parquet('{indexed_path}')
                WHERE source_type = ? AND relation = ? AND target_type = ?
                """,
                [source_type, relation, target_type],
            ).fetchnumpy()

            heads = arrays["head"].astype(np.int64, copy=False)
            tails = arrays["tail"].astype(np.int64, copy=False)
            local_heads = global_to_local[heads]
            local_tails = global_to_local[tails]
            if np.any(local_heads < 0) or np.any(local_tails < 0):
                raise ValueError(f"Could not map local node indices for {key}")

            symmetric = (
                    relation == "CO_EXHIBITED"
                    and source_type == "Artist"
                    and target_type == "Artist"
            )

            train_idx, validation_idx, test_idx = _split_indices(len(heads), relation_id)
            relation_path = RELATION_DIR / f"{file_stem}.npz"
            np.savez_compressed(
                relation_path,
                heads=heads,
                tails=tails,
                local_heads=local_heads,
                local_tails=local_tails,
                train_idx=train_idx,
                validation_idx=validation_idx,
                test_idx=test_idx,
            )

            adjacency_heads = local_heads
            adjacency_tails = local_tails
            if symmetric:
                adjacency_heads = np.concatenate([local_heads, local_tails])
                adjacency_tails = np.concatenate([local_tails, local_heads])

            adjacency = sparse.coo_matrix(
                (
                    np.ones(len(adjacency_heads), dtype=np.uint8),
                    (adjacency_heads, adjacency_tails),
                ),
                shape=(
                    len(type_entities[source_type]),
                    len(type_entities[target_type]),
                ),
            ).tocsr()
            adjacency.sum_duplicates()
            adjacency.data[:] = 1

            adjacency_path = RELATION_DIR / f"{file_stem}_adjacency.npz"
            sparse.save_npz(adjacency_path, adjacency, compressed=True)

            relation_manifest.append(
                {
                    "relation_id": relation_id,
                    "key": key,
                    "source_type": source_type,
                    "relation": relation,
                    "target_type": target_type,
                    "symmetric": symmetric,
                    "edge_count": int(edge_count),
                    "train_count": int(len(train_idx)),
                    "validation_count": int(len(validation_idx)),
                    "test_count": int(len(test_idx)),
                    "relation_path": str(relation_path),
                    "adjacency_path": str(adjacency_path),
                }
            )
    finally:
        connection.close()

    write_json(RELATION_MANIFEST_PATH, {"relations": relation_manifest})
    return relation_manifest


def run() -> None:
    if not NODES_PATH.exists() or not EDGES_PATH.exists():
        raise FileNotFoundError("Run export_snapshot before prepare_training_data")

    nodes = pd.read_parquet(NODES_PATH)
    metadata, properties_list = _build_metadata(nodes)
    attribute_manifest = _build_attribute_features(metadata, properties_list)
    _create_indexed_edges()
    relations = _prepare_relations(metadata)

    summary = {
        "model_entity_count": len(metadata),
        "model_node_types": metadata["type"].value_counts().to_dict(),
        "attribute_dimension": attribute_manifest["feature_dimension"],
        "relation_type_count": len(relations),
        "indexed_edge_count": int(sum(item["edge_count"] for item in relations)),
        "co_exhibited_edge_count": int(
            sum(
                item["edge_count"]
                for item in relations
                if item["relation"] == "CO_EXHIBITED"
            )
        ),
        "co_exhibited_canonicalized_before_split": True,
        "co_exhibited_expanded_both_directions_during_training": True,
        "split_ratios": {
            "train": TRAIN_RATIO,
            "validation": VALIDATION_RATIO,
            "test": TEST_RATIO,
        },
    }
    write_json(PREPARE_SUMMARY_PATH, summary)

    print(f"Prepared {len(metadata):,} entities")
    print(f"Prepared {summary['indexed_edge_count']:,} unique model edges")
    print(f"Prepared {len(relations)} typed relations")


def main() -> None:
    run()


if __name__ == "__main__":
    main()
