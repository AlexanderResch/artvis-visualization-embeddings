import json
import math
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np

from app.ml.config import (
    DISPLAY_NAME_PROPERTIES,
    MODEL_NODE_TYPES,
)


def json_safe(value: Any) -> Any:
    if value is None or isinstance(
            value,
            (str, int, float, bool),
    ):
        if (
                isinstance(value, float)
                and not math.isfinite(value)
        ):
            return None

        return value

    if isinstance(value, (date, datetime)):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            str(key): json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple, set)):
        return [
            json_safe(item)
            for item in value
        ]

    if hasattr(value, "iso_format"):
        try:
            return value.iso_format()
        except Exception:
            pass

    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass

    return str(value)


def json_dumps(value: Any) -> str:
    return json.dumps(
        json_safe(value),
        ensure_ascii=False,
        separators=(",", ":"),
    )


def write_json(
        path: Path,
        data: dict[str, Any],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
            "w",
            encoding="utf-8",
    ) as file:
        json.dump(
            json_safe(data),
            file,
            ensure_ascii=False,
            indent=2,
        )


def read_json(
        path: Path,
) -> dict[str, Any]:
    with path.open(
            "r",
            encoding="utf-8",
    ) as file:
        return json.load(file)


def select_node_type(
        labels: list[str] | None,
) -> str:
    labels = labels or []

    for node_type in MODEL_NODE_TYPES:
        if node_type in labels:
            return node_type

    return (
        sorted(labels)[0]
        if labels
        else "Unlabeled"
    )


def make_entity_identifier(
        node_type: str,
        node_id: Any,
        element_id: str,
) -> str:
    if node_id is not None:
        return f"{node_type}:{node_id}"

    return (
        f"{node_type}:element:{element_id}"
    )


def display_name(
        node_type: str,
        properties: dict[str, Any],
        entity: str,
) -> str:
    property_name = (
        DISPLAY_NAME_PROPERTIES.get(
            node_type
        )
    )

    if property_name:
        value = properties.get(
            property_name
        )

        if value not in (None, ""):
            return str(value)

    for fallback in (
            "name",
            "title",
            "sortname",
    ):
        value = properties.get(fallback)

        if value not in (None, ""):
            return str(value)

    return entity


def first_value(
        properties: dict[str, Any],
        keys: tuple[str, ...],
) -> Any:
    for key in keys:
        value = properties.get(key)

        if value not in (None, ""):
            return value

    return None


def parse_year(
        value: Any,
) -> int | None:
    if (
            value is None
            or isinstance(value, bool)
    ):
        return None

    if isinstance(value, (int, np.integer)):
        year = int(value)

        return (
            year
            if -10000 <= year <= 10000
            else None
        )

    if (
            isinstance(
                value,
                (float, np.floating),
            )
            and math.isfinite(float(value))
    ):
        year = int(value)

        return (
            year
            if -10000 <= year <= 10000
            else None
        )

    match = re.search(
        r"(?<!\d)(-?\d{3,4})(?!\d)",
        str(value),
    )

    return (
        int(match.group(1))
        if match
        else None
    )


def slugify(value: str) -> str:
    return re.sub(
        r"[^A-Za-z0-9_.-]+",
        "_",
        value,
    ).strip("_")


def edge_key(
        source_type: str,
        relation: str,
        target_type: str,
) -> str:
    return (
        f"{source_type}|"
        f"{relation}|"
        f"{target_type}"
    )


def split_edge_key(
        value: str,
) -> tuple[str, str, str]:
    source_type, relation, target_type = (
        value.split("|", 2)
    )

    return (
        source_type,
        relation,
        target_type,
    )