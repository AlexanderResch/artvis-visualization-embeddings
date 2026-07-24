import argparse
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from scipy import sparse

from app.ml.attribute_complex import AttributeEnhancedComplEx
from app.ml.config import (
    ATTRIBUTE_DIM,
    ATTRIBUTE_FEATURES_PATH,
    ATTRIBUTE_HIDDEN_DIM,
    COMPLEX_DIM,
    DEVICE,
    EARLY_STOPPING_PATIENCE,
    ENTITY_METADATA_PATH,
    EVALUATION_CHECKPOINT_PATH,
    FINAL_CHECKPOINT_PATH,
    FINAL_TRAIN_EPOCHS,
    LEARNING_RATE,
    MODEL_DROPOUT,
    MODEL_NODE_TYPES,
    NEGATIVES_PER_POSITIVE,
    RANDOM_SEED,
    RELATION_EPOCH_CAP,
    RELATION_MANIFEST_PATH,
    TRAIN_BATCH_SIZE,
    TRAIN_EPOCHS,
    TORCH_NUM_THREADS,
    TRAINING_EVALUATION_PATH,
    TRAINING_FINAL_PATH,
    TYPE_ENTITIES_PATH,
    TYPE_IDS_PATH,
    VALIDATION_POSITIVES_PER_RELATION,
    WEIGHT_DECAY,
)
from app.ml.utils import read_json, write_json


def _device() -> torch.device:
    if DEVICE != "auto":
        return torch.device(DEVICE)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


@dataclass
class RelationData:
    relation_id: int
    key: str
    source_type: str
    target_type: str
    symmetric: bool
    heads: np.ndarray
    tails: np.ndarray
    local_heads: np.ndarray
    local_tails: np.ndarray
    train_idx: np.ndarray
    validation_idx: np.ndarray
    test_idx: np.ndarray
    adjacency: sparse.csr_matrix
    source_entities: np.ndarray
    target_entities: np.ndarray

    @classmethod
    def load(
            cls,
            item: dict[str, Any],
            type_entities: dict[str, np.ndarray],
    ) -> "RelationData":
        arrays = np.load(item["relation_path"])
        adjacency = sparse.load_npz(item["adjacency_path"]).tocsr()
        return cls(
            relation_id=int(item["relation_id"]),
            key=str(item["key"]),
            source_type=str(item["source_type"]),
            target_type=str(item["target_type"]),
            symmetric=bool(item.get("symmetric", False)),
            heads=arrays["heads"],
            tails=arrays["tails"],
            local_heads=arrays["local_heads"],
            local_tails=arrays["local_tails"],
            train_idx=arrays["train_idx"],
            validation_idx=arrays["validation_idx"],
            test_idx=arrays["test_idx"],
            adjacency=adjacency,
            source_entities=type_entities[str(item["source_type"])],
            target_entities=type_entities[str(item["target_type"])],
        )

    def indices(self, split: str) -> np.ndarray:
        if split == "train":
            return self.train_idx
        if split == "validation":
            return self.validation_idx
        if split == "test":
            return self.test_idx
        if split == "all":
            return np.arange(len(self.heads), dtype=np.int64)
        raise ValueError(f"Unknown split: {split}")

    def sample_positive_indices(
            self,
            split: str,
            count: int,
            rng: np.random.Generator,
    ) -> np.ndarray:
        candidates = self.indices(split)
        if len(candidates) == 0:
            return candidates
        return rng.choice(candidates, size=count, replace=len(candidates) < count)

    def _directed_positives(
            self,
            selected: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        original_heads = self.heads[selected]
        original_tails = self.tails[selected]
        original_local_heads = self.local_heads[selected]
        original_local_tails = self.local_tails[selected]

        positive_heads = original_heads
        positive_tails = original_tails
        positive_local_heads = original_local_heads
        positive_local_tails = original_local_tails

        if self.symmetric:
            positive_heads = np.concatenate([original_heads, original_tails])
            positive_tails = np.concatenate([original_tails, original_heads])
            positive_local_heads = np.concatenate(
                [original_local_heads, original_local_tails]
            )
            positive_local_tails = np.concatenate(
                [original_local_tails, original_local_heads]
            )

        return (
            positive_heads,
            positive_tails,
            positive_local_heads,
            positive_local_tails,
        )

    def make_batch_from_indices(
            self,
            selected: np.ndarray,
            negatives_per_positive: int,
            rng: np.random.Generator,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        if len(selected) == 0:
            return (
                np.empty(0, dtype=np.int64),
                np.empty(0, dtype=np.int64),
                np.empty(0, dtype=np.int64),
                np.empty(0, dtype=np.float32),
            )

        (
            positive_heads,
            positive_tails,
            positive_local_heads,
            positive_local_tails,
        ) = self._directed_positives(selected)

        repeated_heads = np.repeat(positive_heads, negatives_per_positive)
        repeated_tails = np.repeat(positive_tails, negatives_per_positive)
        repeated_local_heads = np.repeat(positive_local_heads, negatives_per_positive)
        repeated_local_tails = np.repeat(positive_local_tails, negatives_per_positive)
        corrupt_head = rng.random(len(repeated_heads)) < 0.5

        negative_heads = repeated_heads.copy()
        negative_tails = repeated_tails.copy()
        candidate_local_heads = repeated_local_heads.copy()
        candidate_local_tails = repeated_local_tails.copy()

        head_positions = np.flatnonzero(corrupt_head)
        tail_positions = np.flatnonzero(~corrupt_head)
        if len(head_positions):
            candidate_local_heads[head_positions] = rng.integers(
                0,
                len(self.source_entities),
                size=len(head_positions),
            )
        if len(tail_positions):
            candidate_local_tails[tail_positions] = rng.integers(
                0,
                len(self.target_entities),
                size=len(tail_positions),
            )

        for _ in range(50):
            is_positive = self.adjacency[
                candidate_local_heads,
                candidate_local_tails,
            ].A1.astype(bool)
            if not is_positive.any():
                break

            bad_head_positions = np.flatnonzero(is_positive & corrupt_head)
            bad_tail_positions = np.flatnonzero(is_positive & ~corrupt_head)

            if len(bad_head_positions):
                candidate_local_heads[bad_head_positions] = rng.integers(
                    0,
                    len(self.source_entities),
                    size=len(bad_head_positions),
                )
            if len(bad_tail_positions):
                candidate_local_tails[bad_tail_positions] = rng.integers(
                    0,
                    len(self.target_entities),
                    size=len(bad_tail_positions),
                )
        else:
            raise RuntimeError(f"Could not sample filtered negatives for {self.key}")

        negative_heads[corrupt_head] = self.source_entities[
            candidate_local_heads[corrupt_head]
        ]
        negative_tails[~corrupt_head] = self.target_entities[
            candidate_local_tails[~corrupt_head]
        ]

        heads = np.concatenate([positive_heads, negative_heads])
        tails = np.concatenate([positive_tails, negative_tails])
        relations = np.full(len(heads), self.relation_id, dtype=np.int64)
        labels = np.concatenate(
            [
                np.ones(len(positive_heads), dtype=np.float32),
                np.zeros(len(negative_heads), dtype=np.float32),
            ]
        )
        permutation = rng.permutation(len(heads))
        return (
            heads[permutation],
            relations[permutation],
            tails[permutation],
            labels[permutation],
        )

    def make_batch(
            self,
            split: str,
            positive_count: int,
            negatives_per_positive: int,
            rng: np.random.Generator,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        selected = self.sample_positive_indices(split, positive_count, rng)
        return self.make_batch_from_indices(selected, negatives_per_positive, rng)


def _load_relations() -> tuple[list[RelationData], dict[str, np.ndarray]]:
    manifest = read_json(RELATION_MANIFEST_PATH)["relations"]
    type_archive = np.load(TYPE_ENTITIES_PATH)
    type_entities = {
        node_type: type_archive[node_type].astype(np.int64, copy=False)
        for node_type in MODEL_NODE_TYPES
    }
    relations = [RelationData.load(item, type_entities) for item in manifest]
    return relations, type_entities


def _score_batch(
        model: AttributeEnhancedComplEx,
        heads: np.ndarray,
        relations: np.ndarray,
        tails: np.ndarray,
        labels: np.ndarray,
        attributes: torch.Tensor,
        type_ids: torch.Tensor,
        device: torch.device,
) -> tuple[torch.Tensor, torch.Tensor]:
    head_ids = torch.from_numpy(heads).long().to(device)
    relation_ids = torch.from_numpy(relations).long().to(device)
    tail_ids = torch.from_numpy(tails).long().to(device)
    target = torch.from_numpy(labels).float().to(device)

    scores = model.score(
        head_ids,
        relation_ids,
        tail_ids,
        attributes[head_ids],
        attributes[tail_ids],
        type_ids[head_ids],
        type_ids[tail_ids],
    )
    return scores, target


@torch.no_grad()
def _validation_loss(
        model: AttributeEnhancedComplEx,
        relations: list[RelationData],
        attributes: torch.Tensor,
        type_ids: torch.Tensor,
        device: torch.device,
) -> float | None:
    validation_rng = np.random.default_rng(RANDOM_SEED + 5000)
    model.eval()
    losses: list[float] = []

    for relation in relations:
        count = min(len(relation.validation_idx), VALIDATION_POSITIVES_PER_RELATION)
        if count == 0:
            continue

        heads, relation_ids, tails, labels = relation.make_batch(
            "validation",
            count,
            NEGATIVES_PER_POSITIVE,
            validation_rng,
        )
        scores, target = _score_batch(
            model,
            heads,
            relation_ids,
            tails,
            labels,
            attributes,
            type_ids,
            device,
        )
        losses.append(float(F.binary_cross_entropy_with_logits(scores, target).cpu()))

    model.train()
    return float(np.mean(losses)) if losses else None


def _save_checkpoint(
        path: Path,
        model: AttributeEnhancedComplEx,
        num_entities: int,
        num_relations: int,
        num_types: int,
        mode: str,
) -> None:
    torch.save(
        {
            "model_state": model.state_dict(),
            "num_entities": num_entities,
            "num_relations": num_relations,
            "num_types": num_types,
            "attribute_dim": ATTRIBUTE_DIM,
            "complex_dim": COMPLEX_DIM,
            "attribute_hidden_dim": ATTRIBUTE_HIDDEN_DIM,
            "dropout": MODEL_DROPOUT,
            "mode": mode,
        },
        path,
    )


def run(mode: str = "evaluation") -> None:
    if mode not in {"evaluation", "final"}:
        raise ValueError("mode must be evaluation or final")

    torch.set_num_threads(max(1, TORCH_NUM_THREADS))
    random.seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)
    torch.manual_seed(RANDOM_SEED)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(RANDOM_SEED)

    metadata = pd.read_parquet(ENTITY_METADATA_PATH)
    attribute_array = np.load(ATTRIBUTE_FEATURES_PATH, mmap_mode="r")
    device = _device()

    attributes = torch.from_numpy(np.array(attribute_array, copy=True)).float().to(device)
    type_ids = torch.from_numpy(np.load(TYPE_IDS_PATH)).long().to(device)
    relations, _ = _load_relations()

    model = AttributeEnhancedComplEx(
        num_entities=len(metadata),
        num_relations=len(relations),
        num_types=len(MODEL_NODE_TYPES),
        attribute_dim=ATTRIBUTE_DIM,
        complex_dim=COMPLEX_DIM,
        attribute_hidden_dim=ATTRIBUTE_HIDDEN_DIM,
        dropout=MODEL_DROPOUT,
    ).to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )

    epochs = TRAIN_EPOCHS if mode == "evaluation" else FINAL_TRAIN_EPOCHS
    split = "train" if mode == "evaluation" else "all"
    rng = np.random.default_rng(RANDOM_SEED + (0 if mode == "evaluation" else 1000))
    best_validation = math.inf
    best_epoch = 0
    patience = 0
    history: list[dict[str, Any]] = []
    checkpoint_path = (
        EVALUATION_CHECKPOINT_PATH if mode == "evaluation" else FINAL_CHECKPOINT_PATH
    )

    relation_states: dict[int, dict[str, Any]] = {}
    for relation in relations:
        base_indices = relation.indices(split)
        relation_states[relation.relation_id] = {
            "base": base_indices,
            "permutation": rng.permutation(base_indices),
            "cursor": 0,
            "sampled_total": 0,
        }

    print(f"Training Attribute-Enhanced ComplEx in {mode} mode on {device}")

    for epoch in range(1, epochs + 1):
        model.train()
        relation_order = list(relations)
        rng.shuffle(relation_order)
        epoch_losses: list[float] = []
        seen_directed_positives = 0

        for relation in relation_order:
            state = relation_states[relation.relation_id]
            available = len(state["base"])
            if available == 0:
                continue

            epoch_positive_count = available
            if RELATION_EPOCH_CAP > 0:
                epoch_positive_count = min(epoch_positive_count, RELATION_EPOCH_CAP)

            selected_parts: list[np.ndarray] = []
            remaining_to_select = epoch_positive_count

            while remaining_to_select > 0:
                permutation = state["permutation"]
                cursor = int(state["cursor"])
                available_in_cycle = len(permutation) - cursor
                take = min(remaining_to_select, available_in_cycle)
                selected_parts.append(permutation[cursor : cursor + take])
                state["cursor"] = cursor + take
                state["sampled_total"] += take
                remaining_to_select -= take

                if state["cursor"] >= len(permutation):
                    state["permutation"] = rng.permutation(state["base"])
                    state["cursor"] = 0

            selected_for_epoch = np.concatenate(selected_parts)
            batch_count = max(1, math.ceil(epoch_positive_count / TRAIN_BATCH_SIZE))

            for batch_index in range(batch_count):
                start_index = batch_index * TRAIN_BATCH_SIZE
                selected = selected_for_epoch[start_index : start_index + TRAIN_BATCH_SIZE]
                if len(selected) == 0:
                    continue

                heads, relation_ids, tails, labels = relation.make_batch_from_indices(
                    selected,
                    NEGATIVES_PER_POSITIVE,
                    rng,
                )

                optimizer.zero_grad(set_to_none=True)
                scores, target = _score_batch(
                    model,
                    heads,
                    relation_ids,
                    tails,
                    labels,
                    attributes,
                    type_ids,
                    device,
                )
                loss = F.binary_cross_entropy_with_logits(scores, target)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
                optimizer.step()

                epoch_losses.append(float(loss.detach().cpu()))
                seen_directed_positives += len(selected) * (2 if relation.symmetric else 1)

        validation = None
        if mode == "evaluation":
            validation = _validation_loss(
                model,
                relations,
                attributes,
                type_ids,
                device,
            )

            if validation is not None and validation < best_validation - 1e-5:
                best_validation = validation
                best_epoch = epoch
                patience = 0
                _save_checkpoint(
                    checkpoint_path,
                    model,
                    len(metadata),
                    len(relations),
                    len(MODEL_NODE_TYPES),
                    mode,
                )
            else:
                patience += 1
        else:
            _save_checkpoint(
                checkpoint_path,
                model,
                len(metadata),
                len(relations),
                len(MODEL_NODE_TYPES),
                mode,
            )

        row = {
            "epoch": epoch,
            "training_loss": float(np.mean(epoch_losses)) if epoch_losses else None,
            "validation_loss": validation,
            "directed_positive_triples_sampled": seen_directed_positives,
        }
        history.append(row)
        print(row)

        if mode == "evaluation" and patience >= EARLY_STOPPING_PATIENCE:
            print(f"Early stopping after epoch {epoch}")
            break

    if mode == "evaluation" and not checkpoint_path.exists():
        _save_checkpoint(
            checkpoint_path,
            model,
            len(metadata),
            len(relations),
            len(MODEL_NODE_TYPES),
            mode,
        )
        best_epoch = len(history)

    relation_coverage = {}
    for relation in relations:
        state = relation_states[relation.relation_id]
        available = len(state["base"])
        relation_coverage[relation.key] = (
            min(int(state["sampled_total"]), available) / available
            if available
            else 0.0
        )

    summary = {
        "mode": mode,
        "model": "Attribute-Enhanced ComplEx",
        "literal_fusion": "learned gated fusion inspired by LiteralE",
        "device": str(device),
        "entity_count": len(metadata),
        "typed_relation_count": len(relations),
        "complex_dimension": COMPLEX_DIM,
        "exported_real_dimension": 2 * COMPLEX_DIM,
        "attribute_dimension": ATTRIBUTE_DIM,
        "relation_epoch_cap": RELATION_EPOCH_CAP,
        "negative_samples_per_positive": NEGATIVES_PER_POSITIVE,
        "best_epoch": best_epoch if mode == "evaluation" else len(history),
        "best_validation_loss": None if best_validation == math.inf else best_validation,
        "history": history,
        "relation_coverage": relation_coverage,
        "checkpoint": checkpoint_path,
    }
    write_json(
        TRAINING_EVALUATION_PATH if mode == "evaluation" else TRAINING_FINAL_PATH,
        summary,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["evaluation", "final"], default="evaluation")
    arguments = parser.parse_args()
    run(arguments.mode)


if __name__ == "__main__":
    main()
