import argparse
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.metrics import adjusted_mutual_info_score, adjusted_rand_score

from app.ml.prepare_training_data import file_hash
from app.ml.utils import make_entity_identifier, write_json


def reference_pairs(reference):
    entities = sorted(reference.artist_entity.unique())
    groups = sorted(reference.group_entity.unique())
    artist_index = {entity: index for index, entity in enumerate(entities)}
    group_index = {entity: index for index, entity in enumerate(groups)}
    matrix = sparse.csr_matrix((np.ones(len(reference), dtype=np.int32), (
        reference.artist_entity.map(artist_index), reference.group_entity.map(group_index),
    )), shape=(len(entities), len(groups)))
    left, right = np.triu_indices(len(entities), k=1)
    shared = np.asarray(matrix[left].multiply(matrix[right]).sum(axis=1)).ravel() > 0
    return entities, left, right, shared


def evaluate_groups(artists, labels, reference):
    entities, left, right, shared = reference_pairs(reference)
    if not len(entities):
        raise ValueError("The reference population is empty.")
    assignments = dict(zip(artists.entity, labels, strict=True))
    predicted = np.array([assignments.get(entity, -1) for entity in entities], dtype=int)
    same_cluster = (predicted[left] >= 0) & (predicted[left] == predicted[right])
    tp = int(np.sum(shared & same_cluster))
    fp = int(np.sum(~shared & same_cluster))
    fn = int(np.sum(shared & ~same_cluster))
    tn = int(np.sum(~shared & ~same_cluster))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    counts = reference.groupby("artist_entity").group_entity.nunique()
    single = reference.loc[reference.artist_entity.isin(counts.index[counts.eq(1)])]
    single = single.drop_duplicates("artist_entity").sort_values("artist_entity")
    single_predicted = np.array([assignments.get(entity, -1) for entity in single.artist_entity], dtype=int)
    noise = single_predicted < 0
    # Unassigned artists are distinct singletons, not one artificial reference group.
    single_predicted[noise] = max(0, int(predicted.max()) + 1) + np.arange(int(noise.sum()))
    return {
        "reference_artist_count": len(entities), "reference_group_count": int(reference.group_entity.nunique()),
        "overlapping_reference_artists": int(counts.gt(1).sum()),
        "reference_missing_embeddings": sum(entity not in assignments for entity in entities),
        "reference_assigned_fraction": float(np.mean(predicted >= 0)),
        "pair_count": len(shared), "positive_pair_count": int(shared.sum()),
        "pair_tp": tp, "pair_fp": fp, "pair_fn": fn, "pair_tn": tn,
        "pair_precision": precision, "pair_recall": recall,
        "pair_f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.0,
        "single_label_artist_count": len(single),
        "ari_single_label_noise_singletons": float(adjusted_rand_score(single.group_entity, single_predicted)) if len(single) > 1 else None,
        "ami_single_label_noise_singletons": float(adjusted_mutual_info_score(single.group_entity, single_predicted)) if len(single) > 1 else None,
    }


def export_reference(directory, snapshot):
    from app.db import get_driver

    directory.mkdir(parents=True, exist_ok=True)
    if (directory / "group_reference.parquet").exists():
        raise FileExistsError("Reference labels already exist.")
    with get_driver().session() as session:
        records = session.run("""
            MATCH (a:Artist)-[:MEMBER_OF]->(g:Group)
            RETURN DISTINCT a.id AS artist_id, elementId(a) AS artist_element_id,
                g.id AS group_id, elementId(g) AS group_element_id,
                coalesce(g.name, g.title, toString(g.id)) AS group_name
        """)
        rows = [{
            "artist_entity": make_entity_identifier("Artist", row["artist_id"], row["artist_element_id"]),
            "artist_id": str(row["artist_id"]) if row["artist_id"] is not None else None,
            "group_entity": make_entity_identifier("Group", row["group_id"], row["group_element_id"]),
            "group_id": str(row["group_id"]) if row["group_id"] is not None else None,
            "group_name": row["group_name"],
        } for row in records]
        group_count = session.run("MATCH (g:Group) RETURN count(g) AS n").single()["n"]
    reference = pd.DataFrame(rows).drop_duplicates(["artist_entity", "group_entity"])
    with duckdb.connect() as connection:
        stored = connection.execute("""
            SELECT DISTINCT source_entity, target_entity FROM read_parquet(?)
            WHERE relation='MEMBER_OF' AND source_type='Artist' AND target_type='Group'
        """, [str(snapshot / "edges.parquet")]).fetchall()
    if set(stored) != set(zip(reference.artist_entity, reference.group_entity, strict=True)):
        raise ValueError("Neo4j memberships differ from the structural snapshot. Export a fresh snapshot first.")
    entities = np.array(sorted(reference.artist_entity.unique()))
    shuffled = np.random.default_rng(2026).permutation(entities)
    validation = set(shuffled[:len(shuffled) // 2])
    reference["split"] = np.where(reference.artist_entity.isin(validation), "validation", "test")
    reference = reference.sort_values(["artist_entity", "group_entity"]).reset_index(drop=True)
    reference.to_parquet(directory / "group_reference.parquet", index=False, compression="zstd")
    counts = reference.groupby("artist_entity").size()
    summary = {
        "source": "Neo4j Artist-MEMBER_OF-Group, verified against the raw snapshot",
        "memberships": len(reference), "known_artists": len(entities), "groups_in_database": group_count,
        "groups_with_known_artists": reference.group_entity.nunique(),
        "artists_with_multiple_groups": int(counts.gt(1).sum()), "maximum_groups_per_artist": int(counts.max()),
        "split_seed": 2026, "split_unit": "Artist; all memberships of one artist stay together",
        "splits": {}, "sha256": file_hash(directory / "group_reference.parquet"),
        "limitations": "Recorded memberships can be incomplete. Unlabeled artists are excluded from reference scoring. Pairwise group overlap is not necessarily a disjoint partition.",
    }
    for name, group in reference.groupby("split"):
        population, _, _, shared = reference_pairs(group)
        summary["splits"][name] = {"artists": len(population), "groups": group.group_entity.nunique(),
                                  "pairs": len(shared), "positive_pairs": int(shared.sum())}
    write_json(directory / "group_reference_summary.json", summary)
    print(summary, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--export-dir", type=Path, required=True)
    parser.add_argument("--snapshot-dir", type=Path, required=True)
    arguments = parser.parse_args()
    export_reference(arguments.export_dir, arguments.snapshot_dir)


if __name__ == "__main__":
    main()
