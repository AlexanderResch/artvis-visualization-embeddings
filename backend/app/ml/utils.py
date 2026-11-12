import json
import math
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.ml.config import DISPLAY_NAME_PROPERTIES, MODEL_NODE_TYPES


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, (float, np.floating)):
        return float(value) if math.isfinite(value) else None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, np.ndarray)):
        return [json_safe(item) for item in value]
    if isinstance(value, (date, datetime)) or hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "iso_format"):
        return value.iso_format()
    return str(value)


def json_dumps(value: Any) -> str:
    return json.dumps(json_safe(value), ensure_ascii=False, allow_nan=False)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(json_safe(data), ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def read_table(path, dtype=None):
    frame = pd.read_parquet(path)
    for column, kind in (dtype or {}).items():
        if column in frame and kind is str:
            frame[column] = frame[column].astype("string")
    return frame


def select_node_type(labels: list[str] | None) -> str:
    labels = labels or []
    return next((kind for kind in MODEL_NODE_TYPES if kind in labels),
                sorted(labels)[0] if labels else "Unlabeled")


def make_entity_identifier(node_type: str, node_id: Any, element_id: str) -> str:
    suffix = str(node_id) if node_id is not None else f"element:{element_id}"
    return f"{node_type}:{suffix}"


def first_value(properties: dict, keys: tuple[str, ...]) -> Any:
    return next((properties[key] for key in keys if properties.get(key) not in (None, "")), None)


def display_name(node_type: str, properties: dict, entity: str) -> str:
    value = first_value(properties, (
        DISPLAY_NAME_PROPERTIES.get(node_type, "name"), "name", "title", "sortname",
    ))
    return str(value) if value is not None else entity


def parse_year(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float, np.number)):
        return int(value) if np.isfinite(value) and -10000 <= value <= 10000 else None
    match = re.search(r"(?<!\d)(-?\d{3,4})(?!\d)", str(value))
    return int(match.group(1)) if match else None
