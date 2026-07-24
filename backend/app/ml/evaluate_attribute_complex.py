import numpy as np
import pandas as pd
import torch
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.neighbors import NearestNeighbors

from app.ml.attribute_complex import AttributeEnhancedComplEx
from app.ml.config import (
    ATTRIBUTE_FEATURES_PATH,
    ENTITY_METADATA_PATH,
    EVALUATION_CHECKPOINT_PATH,
    EVALUATION_POSITIVES_PER_RELATION,
    EVALUATION_RANKING_NEGATIVES,
    LINK_EVALUATION_PATH,
    NEGATIVES_PER_POSITIVE,
    RANDOM_SEED,
    TYPE_IDS_PATH,
)
from app.ml.train_attribute_complex import RelationData, _device, _load_relations, _score_batch
from app.ml.utils import write_json

NEIGHBOR_K_VALUES = (1, 5, 10, 20)
SCORE_BATCH_SIZE = 65536


def _load_model(device: torch.device) -> AttributeEnhancedComplEx:
    checkpoint = torch.load(EVALUATION_CHECKPOINT_PATH, map_location=device)
    model = AttributeEnhancedComplEx(
        num_entities=int(checkpoint["num_entities"]),
        num_relations=int(checkpoint["num_relations"]),
        num_types=int(checkpoint["num_types"]),
        attribute_dim=int(checkpoint["attribute_dim"]),
        complex_dim=int(checkpoint["complex_dim"]),
        attribute_hidden_dim=int(checkpoint["attribute_hidden_dim"]),
        dropout=float(checkpoint["dropout"]),
    ).to(device)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()
    return model


@torch.no_grad()
def _entity_embeddings(
        model: AttributeEnhancedComplEx,
        entity_indices: np.ndarray,
        attributes: torch.Tensor,
        type_ids: torch.Tensor,
        device: torch.device,
        batch_size: int = 8192,
) -> np.ndarray:
    output = np.empty((len(entity_indices), 2 * model.complex_dim), dtype=np.float32)

    for start in range(0, len(entity_indices), batch_size):
        batch_indices = entity_indices[start : start + batch_size]
        ids = torch.from_numpy(batch_indices).long().to(device)
        representation = model.entity_representation(
            ids,
            attributes[ids],
            type_ids[ids],
        )
        output[start : start + len(batch_indices)] = representation.cpu().numpy()

    return output


@torch.no_grad()
def _score_triples(
        model: AttributeEnhancedComplEx,
        heads: np.ndarray,
        relation_id: int,
        tails: np.ndarray,
        attributes: torch.Tensor,
        type_ids: torch.Tensor,
        device: torch.device,
) -> np.ndarray:
    result = np.empty(len(heads), dtype=np.float32)

    for start in range(0, len(heads), SCORE_BATCH_SIZE):
        stop = min(start + SCORE_BATCH_SIZE, len(heads))
        head_ids = torch.from_numpy(heads[start:stop]).long().to(device)
        tail_ids = torch.from_numpy(tails[start:stop]).long().to(device)
        relation_ids = torch.full(
            (stop - start,),
            relation_id,
            dtype=torch.long,
            device=device,
        )
        scores = model.score(
            head_ids,
            relation_ids,
            tail_ids,
            attributes[head_ids],
            attributes[tail_ids],
            type_ids[head_ids],
            type_ids[tail_ids],
        )
        result[start:stop] = scores.cpu().numpy()

    return result


def _sample_filtered_tail_candidates(
        relation: RelationData,
        selected: np.ndarray,
        negative_count: int,
        rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    (
        positive_heads,
        positive_tails,
        positive_local_heads,
        _,
    ) = relation._directed_positives(selected)

    candidate_local_tails = rng.integers(
        0,
        len(relation.target_entities),
        size=(len(positive_heads), negative_count),
    )

    repeated_local_heads = np.repeat(positive_local_heads, negative_count)
    flat_candidates = candidate_local_tails.reshape(-1)

    for _ in range(50):
        known = relation.adjacency[
            repeated_local_heads,
            flat_candidates,
        ].A1.astype(bool)
        if not known.any():
            break
        flat_candidates[known] = rng.integers(
            0,
            len(relation.target_entities),
            size=int(known.sum()),
        )
    else:
        raise RuntimeError(f"Could not sample ranking negatives for {relation.key}")

    negative_tails = relation.target_entities[flat_candidates].reshape(
        len(positive_heads),
        negative_count,
    )
    return positive_heads, positive_tails, negative_tails


def _sampled_ranking_metrics(
        model: AttributeEnhancedComplEx,
        relation: RelationData,
        selected: np.ndarray,
        attributes: torch.Tensor,
        type_ids: torch.Tensor,
        device: torch.device,
        rng: np.random.Generator,
) -> dict[str, float | int | None]:
    if len(selected) == 0:
        return {
            "evaluated_directed_positives": 0,
            "negative_candidates_per_positive": EVALUATION_RANKING_NEGATIVES,
            "sampled_mrr": None,
            "sampled_hits_at_1": None,
            "sampled_hits_at_3": None,
            "sampled_hits_at_10": None,
        }

    positive_heads, positive_tails, negative_tails = _sample_filtered_tail_candidates(
        relation,
        selected,
        EVALUATION_RANKING_NEGATIVES,
        rng,
    )

    positive_scores = _score_triples(
        model,
        positive_heads,
        relation.relation_id,
        positive_tails,
        attributes,
        type_ids,
        device,
    )

    flat_negative_heads = np.repeat(positive_heads, EVALUATION_RANKING_NEGATIVES)
    flat_negative_tails = negative_tails.reshape(-1)
    negative_scores = _score_triples(
        model,
        flat_negative_heads,
        relation.relation_id,
        flat_negative_tails,
        attributes,
        type_ids,
        device,
    ).reshape(len(positive_heads), EVALUATION_RANKING_NEGATIVES)

    ranks = 1 + np.sum(negative_scores >= positive_scores[:, None], axis=1)
    reciprocal_ranks = 1.0 / ranks

    return {
        "evaluated_directed_positives": int(len(ranks)),
        "negative_candidates_per_positive": EVALUATION_RANKING_NEGATIVES,
        "sampled_mrr": float(np.mean(reciprocal_ranks)),
        "sampled_hits_at_1": float(np.mean(ranks <= 1)),
        "sampled_hits_at_3": float(np.mean(ranks <= 3)),
        "sampled_hits_at_10": float(np.mean(ranks <= 10)),
    }


def run() -> None:
    if not EVALUATION_CHECKPOINT_PATH.exists():
        raise FileNotFoundError("Run evaluation-mode training first")

    device = _device()
    model = _load_model(device)
    metadata = pd.read_parquet(ENTITY_METADATA_PATH)
    attributes = torch.from_numpy(
        np.array(np.load(ATTRIBUTE_FEATURES_PATH, mmap_mode="r"), copy=True)
    ).float().to(device)
    type_ids = torch.from_numpy(np.load(TYPE_IDS_PATH)).long().to(device)
    relations, _ = _load_relations()
    rng = np.random.default_rng(RANDOM_SEED + 2000)

    relation_metrics: list[dict] = []
    weighted_auc_numerator = 0.0
    weighted_ap_numerator = 0.0
    weighted_mrr_numerator = 0.0
    weighted_count = 0

    for relation in relations:
        positive_count = min(
            len(relation.test_idx),
            EVALUATION_POSITIVES_PER_RELATION,
        )
        if positive_count == 0:
            continue

        selected = relation.sample_positive_indices("test", positive_count, rng)
        heads, relation_ids, tails, labels = relation.make_batch_from_indices(
            selected,
            NEGATIVES_PER_POSITIVE,
            rng,
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

        probabilities = torch.sigmoid(scores).detach().cpu().numpy()
        y_true = target.cpu().numpy()
        auc = float(roc_auc_score(y_true, probabilities))
        average_precision = float(average_precision_score(y_true, probabilities))
        ranking = _sampled_ranking_metrics(
            model,
            relation,
            selected,
            attributes,
            type_ids,
            device,
            rng,
        )

        directed_count = int(ranking["evaluated_directed_positives"] or 0)
        relation_metrics.append(
            {
                "relation_id": relation.relation_id,
                "key": relation.key,
                "canonical_test_positive_count": positive_count,
                "roc_auc": auc,
                "average_precision": average_precision,
                **ranking,
            }
        )

        weighted_auc_numerator += auc * directed_count
        weighted_ap_numerator += average_precision * directed_count
        weighted_mrr_numerator += float(ranking["sampled_mrr"] or 0.0) * directed_count
        weighted_count += directed_count

    artist_rows = metadata.loc[metadata["type"] == "Artist"].copy()
    artist_global_indices = artist_rows["global_index"].to_numpy(dtype=np.int64)
    artist_vectors = _entity_embeddings(
        model,
        artist_global_indices,
        attributes,
        type_ids,
        device,
    )
    norms = np.linalg.norm(artist_vectors, axis=1, keepdims=True)
    artist_vectors = artist_vectors / np.maximum(norms, 1e-12)
    global_to_artist_position = {
        int(global_index): position
        for position, global_index in enumerate(artist_global_indices)
    }

    co_exhibited = next(
        (relation for relation in relations if relation.key == "Artist|CO_EXHIBITED|Artist"),
        None,
    )
    neighbor_metrics = None

    if co_exhibited is not None and len(co_exhibited.test_idx):
        held_out: dict[int, set[int]] = {}
        for edge_index in co_exhibited.test_idx:
            head = int(co_exhibited.heads[edge_index])
            tail = int(co_exhibited.tails[edge_index])
            held_out.setdefault(head, set()).add(tail)
            held_out.setdefault(tail, set()).add(head)

        max_k = max(NEIGHBOR_K_VALUES)
        neighbor_model = NearestNeighbors(
            n_neighbors=min(max_k + 1, len(artist_vectors)),
            metric="cosine",
            algorithm="brute",
            n_jobs=-1,
        ).fit(artist_vectors)
        _, neighbor_indices = neighbor_model.kneighbors(artist_vectors)

        recalls = {k: [] for k in NEIGHBOR_K_VALUES}
        hits = {k: [] for k in NEIGHBOR_K_VALUES}
        evaluated_artists = 0

        for global_index, positive_neighbors in held_out.items():
            position = global_to_artist_position.get(global_index)
            if position is None or not positive_neighbors:
                continue

            ranked_globals = [
                int(artist_global_indices[candidate])
                for candidate in neighbor_indices[position]
                if int(artist_global_indices[candidate]) != global_index
            ]
            evaluated_artists += 1

            for k in NEIGHBOR_K_VALUES:
                predicted = set(ranked_globals[:k])
                overlap = len(predicted.intersection(positive_neighbors))
                recalls[k].append(overlap / len(positive_neighbors))
                hits[k].append(float(overlap > 0))

        neighbor_metrics = {
            "relation": co_exhibited.key,
            "evaluated_artist_count": evaluated_artists,
            "recall_at_k": {
                str(k): float(np.mean(values)) if values else None
                for k, values in recalls.items()
            },
            "hit_rate_at_k": {
                str(k): float(np.mean(values)) if values else None
                for k, values in hits.items()
            },
            "note": "Metrics use only held-out CO_EXHIBITED test pairs.",
        }

    result = {
        "model": "Attribute-Enhanced ComplEx",
        "relation_metrics": relation_metrics,
        "weighted_roc_auc": (
            weighted_auc_numerator / weighted_count if weighted_count else None
        ),
        "weighted_average_precision": (
            weighted_ap_numerator / weighted_count if weighted_count else None
        ),
        "weighted_sampled_mrr": (
            weighted_mrr_numerator / weighted_count if weighted_count else None
        ),
        "artist_co_exhibited_retrieval": neighbor_metrics,
        "negative_sampling": (
            "type-constrained and filtered against all known edges of each typed relation"
        ),
        "ranking_note": (
            "Sampled MRR and Hits use a fixed number of filtered negative tail candidates, "
            "not exhaustive ranking over every entity."
        ),
    }
    write_json(LINK_EVALUATION_PATH, result)
    print(f"Saved evaluation to {LINK_EVALUATION_PATH}")


def main() -> None:
    run()


if __name__ == "__main__":
    main()
