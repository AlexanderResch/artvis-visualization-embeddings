import base64
import binascii
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from app.ml.config import (
    ATTRIBUTE_MANIFEST_PATH,
    EMBEDDING_SUMMARY_PATH,
    HDBSCAN_SUMMARY_PATH,
    LINK_EVALUATION_PATH,
    PREPARE_SUMMARY_PATH,
    PROJECTION_SUMMARY_PATH,
    POSTPROCESSING_RECOMMENDATION_PATH,
    SNAPSHOT_SUMMARY_PATH,
    TRAINING_EVALUATION_PATH,
    TRAINING_FINAL_PATH,
)
from app.ml.utils import read_json

router = APIRouter(prefix="/evaluation", tags=["Evaluation"])

MICRO_ENTRY_DATA_DIR = Path(
    os.getenv(
        "MICRO_ENTRY_DATA_DIR",
        str(Path(__file__).resolve().parents[2] / "data" / "micro_entries"),
    )
)
PARTICIPANT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
ENTRY_ID_PATTERN = re.compile(r"^ME-\d{3,}$")
CAPTURE_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
SCREENSHOT_DATA_PATTERN = re.compile(
    r"^data:image/(?P<format>png|jpeg);base64,(?P<data>.+)$",
    re.DOTALL,
)
MAX_SCREENSHOT_BYTES = 12 * 1024 * 1024
_storage_lock = Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _safe_participant_id(participant_id: str) -> str:
    normalized = participant_id.strip()
    if not PARTICIPANT_ID_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=422,
            detail=(
                "Participant ID must contain 1-40 letters, numbers, "
                "hyphens, or underscores."
            ),
        )
    return normalized


def _participant_dir(participant_id: str) -> Path:
    safe_id = _safe_participant_id(participant_id)
    return MICRO_ENTRY_DATA_DIR / safe_id


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def _decode_screenshot(data_url: str) -> tuple[bytes, str]:
    match = SCREENSHOT_DATA_PATTERN.fullmatch(data_url)
    if not match:
        raise HTTPException(
            status_code=422,
            detail="Screenshot must be a PNG or JPEG data URL.",
        )

    try:
        screenshot = base64.b64decode(
            match.group("data"),
            validate=True,
        )
    except (binascii.Error, ValueError) as error:
        raise HTTPException(
            status_code=422,
            detail="Screenshot data is not valid base64.",
        ) from error

    if not screenshot or len(screenshot) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Screenshot is empty or exceeds the 12 MB limit.",
        )

    extension = "jpg" if match.group("format") == "jpeg" else "png"
    return screenshot, extension


class ScreenshotCaptureRequest(BaseModel):
    participant_id: str
    screenshot_data_url: str


class ScreenshotCaptureResponse(BaseModel):
    capture_id: str
    captured_at: str


class MicroEntrySaveRequest(BaseModel):
    participant_id: str
    entry_id: str | None = None
    capture_id: str
    pattern: str
    views: list[str]
    explanation: str
    context: dict[str, Any] = Field(default_factory=dict)

    @field_validator("pattern", "explanation")
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field is required.")
        if len(normalized) > 10000:
            raise ValueError("Text must not exceed 10,000 characters.")
        return normalized

    @field_validator("views")
    @classmethod
    def validate_views(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not normalized:
            raise ValueError("Select at least one interface view.")
        return normalized


class MicroEntrySummary(BaseModel):
    entry_id: str
    version: int
    version_count: int
    created_at: str
    updated_at: str
    pattern: str
    views: list[str]
    explanation: str
    context: dict[str, Any]
    capture_id: str


def _read_entry_summary(entry_dir: Path) -> MicroEntrySummary | None:
    versions = sorted(entry_dir.glob("v*.json"))
    if not versions:
        return None

    try:
        latest = json.loads(versions[-1].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    return MicroEntrySummary(
        entry_id=latest["entry_id"],
        version=int(latest["version"]),
        version_count=len(versions),
        created_at=latest["created_at"],
        updated_at=latest["saved_at"],
        pattern=latest["pattern"],
        views=latest["views"],
        explanation=latest["explanation"],
        context=latest.get("context", {}),
        capture_id=latest["capture_id"],
    )


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
        "postprocessing_comparison": POSTPROCESSING_RECOMMENDATION_PATH,
    }
    response = {name: read_json(path) for name, path in paths.items() if path.exists()}
    if not response:
        raise HTTPException(status_code=404, detail="No evaluation artifacts found")
    return response


@router.post(
    "/micro-entry-captures",
    response_model=ScreenshotCaptureResponse,
)
def create_micro_entry_capture(
    request: ScreenshotCaptureRequest,
):
    participant_dir = _participant_dir(request.participant_id)
    screenshot, extension = _decode_screenshot(request.screenshot_data_url)

    capture_id = uuid4().hex
    captured_at = _utc_now()
    captures_dir = participant_dir / "captures"
    screenshot_path = captures_dir / f"{capture_id}.{extension}"

    with _storage_lock:
        captures_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path.write_bytes(screenshot)

    return ScreenshotCaptureResponse(
        capture_id=capture_id,
        captured_at=captured_at,
    )


@router.get(
    "/micro-entries",
    response_model=list[MicroEntrySummary],
)
def list_micro_entries(
    participant_id: str = Query(min_length=1, max_length=40),
):
    entries_dir = _participant_dir(participant_id) / "entries"
    if not entries_dir.exists():
        return []

    entries = [
        summary
        for entry_dir in sorted(entries_dir.iterdir())
        if entry_dir.is_dir()
        for summary in [_read_entry_summary(entry_dir)]
        if summary is not None
    ]
    return entries


@router.post(
    "/micro-entries",
    response_model=MicroEntrySummary,
)
def save_micro_entry(
    request: MicroEntrySaveRequest,
):
    participant_dir = _participant_dir(request.participant_id)
    if not CAPTURE_ID_PATTERN.fullmatch(request.capture_id):
        raise HTTPException(status_code=422, detail="Invalid screenshot capture ID.")

    captures_dir = participant_dir / "captures"
    capture_paths = [
        path
        for extension in ("jpg", "png")
        if (path := captures_dir / f"{request.capture_id}.{extension}").exists()
    ]

    with _storage_lock:
        if not capture_paths:
            raise HTTPException(
                status_code=422,
                detail="The screenshot capture could not be found.",
            )
        capture_path = capture_paths[0]
        screenshot_captured_at = datetime.fromtimestamp(
            capture_path.stat().st_mtime,
            tz=timezone.utc,
        ).isoformat(timespec="milliseconds")

        if request.entry_id is None:
            entries_dir = participant_dir / "entries"
            existing_numbers = [
                int(match.group(1))
                for entry_dir in entries_dir.glob("ME-*")
                if (
                    match := re.fullmatch(
                        r"ME-(\d+)",
                        entry_dir.name,
                    )
                )
            ] if entries_dir.exists() else []
            entry_id = f"ME-{max(existing_numbers, default=0) + 1:03d}"
        else:
            if not ENTRY_ID_PATTERN.fullmatch(request.entry_id):
                raise HTTPException(status_code=422, detail="Invalid micro-entry ID.")
            entry_id = request.entry_id

        entry_dir = participant_dir / "entries" / entry_id
        existing_versions = sorted(entry_dir.glob("v*.json"))
        version = len(existing_versions) + 1
        created_at = _utc_now()
        if existing_versions:
            try:
                first_version = json.loads(
                    existing_versions[0].read_text(encoding="utf-8")
                )
                created_at = first_version.get("created_at", created_at)
            except (OSError, json.JSONDecodeError):
                pass

        saved_at = _utc_now()
        payload = {
            "participant_id": request.participant_id.strip(),
            "entry_id": entry_id,
            "version": version,
            "created_at": created_at,
            "saved_at": saved_at,
            "capture_id": request.capture_id,
            "screenshot_file": str(
                Path("captures") / capture_path.name
            ).replace("\\", "/"),
            "screenshot_captured_at": screenshot_captured_at,
            "pattern": request.pattern,
            "views": request.views,
            "explanation": request.explanation,
            "context": request.context,
        }
        _write_json(
            entry_dir / f"v{version:03d}.json",
            payload,
        )

    return MicroEntrySummary(
        entry_id=entry_id,
        version=version,
        version_count=version,
        created_at=created_at,
        updated_at=saved_at,
        pattern=request.pattern,
        views=request.views,
        explanation=request.explanation,
        context=request.context,
        capture_id=request.capture_id,
    )
