"""Regression checks for graph filtering, artifact alignment, and the complete pipeline."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import numpy as np
import pandas as pd

from app.ml.prepare_training_data import prepare
from app.ml.assess_clustering import matched_jaccard
from app.ml.group_evaluation import evaluate_groups


def snapshot():
    nodes, edges = [], []
    for index in range(30):
        artist, item, exhibition = f"Artist:{index}", f"Item:{index}", f"Exhibition:{index // 15}"
        nodes.extend([
            {"entity": artist, "type": "Artist", "id": str(index), "element_id": f"a{index}",
             "properties_json": json.dumps({"sortname": f"Artist {index}", "birthyear": 1850 + index})},
            {"entity": item, "type": "Item", "id": str(index), "element_id": f"i{index}", "properties_json": "{}"},
        ])
        edges.extend([
            {"source_entity": artist, "relation": "EXHIBITED_AT", "target_entity": exhibition},
            {"source_entity": artist, "relation": "CREATED", "target_entity": item},
            {"source_entity": exhibition, "relation": "EXHIBITS", "target_entity": item},
        ])
    for index in range(2):
        nodes.append({"entity": f"Exhibition:{index}", "type": "Exhibition", "id": str(index),
                      "element_id": f"e{index}", "properties_json": "{}"})
    nodes.append({"entity": "Artist:isolated", "type": "Artist", "id": "isolated",
                  "element_id": "isolated", "properties_json": "{}"})
    edges.extend([edges[0], {"source_entity": "Artist:0", "relation": "CO_EXHIBITED", "target_entity": "Artist:1"}])
    return pd.DataFrame(nodes), pd.DataFrame(edges)


class PipelineTests(unittest.TestCase):
    def test_normalized_pca_preserves_embeddings_and_aligned_maps(self):
        import hashlib
        import joblib
        from app.ml.assess_clustering import fit
        from app.ml.cluster_artists import representation

        nodes, edges = snapshot()
        metadata, _, _, _ = prepare(nodes, edges, excluded_relations=())
        artists = metadata.loc[metadata.type.eq("Artist")].reset_index(drop=True)
        artists.insert(0, "artist_index", np.arange(len(artists)))
        generator = np.random.default_rng(7)
        vectors = generator.normal(scale=.02, size=(len(artists), 8)).astype(np.float32)
        vectors[:15, 0] += 1
        vectors[15:, 1] += 1
        vectors *= np.linspace(.2, 10, len(artists), dtype=np.float32)[:, None]
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            artists.to_parquet(directory / "artist_metadata.parquet", index=False)
            np.save(directory / "artist_embeddings.npy", vectors)
            (directory / "embedding_summary.json").write_text(json.dumps({"model": "ComplEx"}))
            original = hashlib.sha256((directory / "artist_embeddings.npy").read_bytes()).hexdigest()
            environment = {**os.environ, "ML_DATA_DIR": temporary, "ML_INPUT_DIR": temporary,
                           "KGE_MODEL": "ComplEx", "KGE_EMBEDDING_DIM": "8", "ML_RANDOM_SEED": "43",
                           "HDBSCAN_NORMALIZE": "true", "HDBSCAN_USE_PCA": "true", "HDBSCAN_PCA_COMPONENTS": "4",
                           "HDBSCAN_MIN_CLUSTER_SIZE": "5", "HDBSCAN_MIN_SAMPLES": "2", "UMAP_N_NEIGHBORS": "5",
                           "NUMBA_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1", "OMP_NUM_THREADS": "1"}
            result = subprocess.run([sys.executable, "-m", "app.ml.run_pipeline", "--steps", "cluster", "project", "materialize"],
                                    env=environment, capture_output=True, text=True, timeout=180)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            transformed, expected_pca = representation(vectors, True, 4, normalize_embeddings=True)
            actual_pca = joblib.load(directory / "artist_hdbscan_pca.joblib")
            self.assertTrue(np.allclose(actual_pca.components_, expected_pca.components_))
            labels = pd.read_parquet(directory / "artist_clusters.parquet").cluster.to_numpy()
            self.assertTrue(np.array_equal(labels, fit(transformed, 5, 2).labels_))
            self.assertEqual(hashlib.sha256((directory / "artist_embeddings.npy").read_bytes()).hexdigest(), original)
            projection = json.loads((directory / "projection_summary.json").read_text())
            self.assertTrue(projection["l2_normalization"])
            self.assertEqual(projection["projection_input_dimension"], 4)
            for dimension in (2, 3):
                frame = pd.read_parquet(directory / f"artist_map_{dimension}d.parquet")
                self.assertTrue(np.array_equal(frame.cluster, labels))
                self.assertTrue(np.isfinite(frame[list("xyz"[:dimension])]).all().all())
                self.assertFalse((directory / f"artist_map_{dimension}d.csv").exists())

    def test_overlapping_reference_groups_and_noise(self):
        artists = pd.DataFrame({"entity": ["A", "B", "C", "D"]})
        reference = pd.DataFrame({"artist_entity": ["A", "B", "B", "C", "D"],
                                  "group_entity": ["G1", "G1", "G2", "G2", "G3"]})
        result = evaluate_groups(artists, np.array([0, 0, 0, -1]), reference)
        self.assertEqual((result["pair_tp"], result["pair_fp"], result["pair_fn"]), (2, 1, 0))
        self.assertAlmostEqual(result["pair_f1"], .8)
        self.assertEqual(result["overlapping_reference_artists"], 1)
        self.assertEqual(result["reference_group_count"], 3)
        self.assertEqual(evaluate_groups(artists, np.full(4, -1), reference)["pair_f1"], 0)
        missing = evaluate_groups(artists.iloc[:2], np.array([0, 0]), reference)
        self.assertEqual(missing["reference_missing_embeddings"], 2)
        self.assertAlmostEqual(missing["pair_recall"], .5)

    def test_reference_memberships_are_excluded_from_training(self):
        nodes, edges = snapshot()
        nodes = pd.concat([nodes, pd.DataFrame([{
            "entity": "Group:1", "type": "Group", "id": "1", "element_id": "g1", "properties_json": "{}",
        }])], ignore_index=True)
        edges = pd.concat([edges, pd.DataFrame([{
            "source_entity": "Artist:0", "relation": "MEMBER_OF", "target_entity": "Group:1",
        }])], ignore_index=True)
        metadata, indexed, _, relations = prepare(nodes, edges, excluded_relations=("MEMBER_OF",))
        self.assertNotIn("MEMBER_OF", relations)
        self.assertNotIn("MEMBER_OF", set(indexed.relation))
        self.assertNotIn("Group:1", set(metadata.entity))

    def test_cluster_stability_ignores_label_names_and_shared_noise(self):
        reference = np.array([0, 0, 1, 1, -1])
        self.assertEqual(matched_jaccard(reference, np.array([7, 7, 9, 9, -1])), 1.0)
        self.assertEqual(matched_jaccard(reference, np.full(5, -1)), 0.0)
        self.assertEqual(matched_jaccard(np.full(5, -1), np.full(5, -1)), 0.0)
        self.assertAlmostEqual(matched_jaccard(reference, np.array([7, 9, 7, 9, -1])), 1 / 3)

    def test_unique_structural_triples_exclude_untrained_entities(self):
        nodes, edges = snapshot()
        metadata, indexed, triples, relations = prepare(nodes, edges, excluded_relations=("CO_EXHIBITED",))
        self.assertEqual(len(triples), 90)
        self.assertNotIn("CO_EXHIBITED", relations)
        self.assertNotIn("Artist:isolated", set(metadata.entity))
        self.assertEqual(len(np.unique(triples[:, [0, 2]])), len(metadata))
        self.assertTrue(np.array_equal(metadata.global_index, np.arange(len(metadata))))
        self.assertEqual(set(indexed.relation), set(relations))
        shuffled = prepare(nodes.sample(frac=1, random_state=4), edges.sample(frac=1, random_state=5),
                           excluded_relations=("CO_EXHIBITED",))
        self.assertTrue(np.array_equal(triples, shuffled[2]))
        self.assertEqual(metadata.entity.tolist(), shuffled[0].entity.tolist())

    def test_coexhibition_inclusion_preserves_existing_ids(self):
        nodes, edges = snapshot()
        metadata, _, _, relations = prepare(nodes, edges, excluded_relations=("CO_EXHIBITED",))
        included, _, triples, augmented = prepare(nodes, edges, excluded_relations=())
        self.assertEqual(len(triples), 91)
        self.assertEqual(included.entity.tolist(), metadata.entity.tolist())
        self.assertEqual({key: augmented[key] for key in relations}, relations)
        self.assertEqual(augmented["CO_EXHIBITED"], len(relations))

    def test_duplicate_entity_identifiers_are_rejected(self):
        nodes, edges = snapshot()
        with self.assertRaisesRegex(ValueError, "duplicate entity"):
            prepare(pd.concat([nodes, nodes.iloc[:1]]), edges)

    def test_four_models_share_inputs_and_preserve_complex_vectors(self):
        import hashlib
        import torch
        from pykeen.models import ComplEx, DistMult, RotatE, TransE
        from pykeen.triples import CoreTriplesFactory

        torch.set_num_threads(1)
        nodes, edges = snapshot()
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source"
            source.mkdir()
            nodes.to_parquet(source / "nodes.parquet")
            edges.to_parquet(source / "edges.parquet")
            environment = {
                **os.environ, "ML_DATA_DIR": str(source), "ML_INPUT_DIR": str(source),
                "KGE_MODEL": "TransE", "KGE_EMBEDDING_DIM": "8", "TRAIN_BATCH_SIZE": "32",
                "HDBSCAN_MIN_CLUSTER_SIZE": "5", "HDBSCAN_MIN_SAMPLES": "2",
                "HDBSCAN_USE_PCA": "false", "INCLUDE_COEXHIBITIONS": "true",
                "NEGATIVE_SAMPLER": "pseudo_typed", "TORCH_NUM_THREADS": "1", "ML_DEVICE": "cpu",
                "UMAP_N_NEIGHBORS": "5",
                "CHECKPOINT_EPOCHS": "1",
            }

            def execute(arguments, success=True):
                result = subprocess.run(
                    [sys.executable, "-m", *arguments], env=environment,
                    capture_output=True, text=True, timeout=300,
                )
                if success:
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                else:
                    self.assertNotEqual(result.returncode, 0)
                return result

            execute(["app.ml.run_pipeline", "--steps", "prepare"])
            input_files = [source / name for name in ("triples.npy", "entity_metadata.parquet", "relation_mapping.json")]
            hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in input_files}
            output = Path(temporary) / "comparison"
            execute(["app.ml.compare_models", "--input-dir", str(source), "--output-dir", str(output),
                     "--seeds", "43", "--epochs", "2", "--embedding-dim", "8"])
            report = json.loads((output / "comparison.json").read_text())
            self.assertEqual(report["status"], "complete")
            self.assertEqual(len(pd.read_parquet(output / "comparison.parquet")), 4)
            self.assertEqual(report["prepared_data_sha256"], hashes)
            self.assertEqual({path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in input_files}, hashes)
            self.assertFalse((source / "artist_embeddings.npy").exists())
            metadata = pd.read_parquet(source / "entity_metadata.parquet")
            relations = json.loads((source / "relation_mapping.json").read_text())
            factory = CoreTriplesFactory(
                mapped_triples=torch.from_numpy(np.load(source / "triples.npy")),
                num_entities=len(metadata), num_relations=len(relations),
            )
            for cls in (TransE, DistMult, ComplEx, RotatE):
                with self.subTest(model=cls.__name__):
                    directory = output / cls.__name__.lower() / "seed_43"
                    training = json.loads((directory / "training_final.json").read_text())
                    self.assertEqual(training["model"], cls.__name__)
                    self.assertEqual(training["prepared_data_sha256"], hashes)
                    self.assertEqual(training["embedding_dimension"], 8)
                    intermediate = json.loads((directory / "epoch_1" / "training_final.json").read_text())
                    self.assertEqual(intermediate["epochs"], 1)
                    self.assertEqual(len(intermediate["training_loss"]), 1)
                    self.assertFalse((directory / "artist_metadata.csv").exists())
                    complex_model = cls in (ComplEx, RotatE)
                    self.assertEqual(training["model_embedding_dimension"], 4 if complex_model else 8)
                    checkpoint = torch.load(directory / f"{cls.__name__.lower()}.pt", weights_only=True)
                    model = cls(triples_factory=factory, random_seed=43, **checkpoint["model_kwargs"])
                    model.load_state_dict(checkpoint["state_dict"])
                    model.eval()
                    artists = pd.read_parquet(directory / "artist_metadata.parquet")
                    with torch.inference_mode():
                        vectors = model.entity_representations[0](indices=torch.as_tensor(artists.global_index.to_numpy()))
                    exported = np.load(directory / "artist_embeddings.npy")
                    self.assertEqual(exported.shape, (30, 8))
                    if complex_model:
                        self.assertTrue(np.allclose(exported[:, :4], vectors.real.numpy()))
                        self.assertTrue(np.allclose(exported[:, 4:], vectors.imag.numpy()))
                        self.assertGreater(float(np.abs(exported[:, 4:]).max()), 0)
                        expected_distance = torch.linalg.vector_norm(vectors[0] - vectors[1]).item()
                        self.assertAlmostEqual(float(np.linalg.norm(exported[0] - exported[1])), expected_distance, places=5)
                    else:
                        self.assertTrue(np.allclose(exported, vectors.numpy()))
                        self.assertTrue(np.allclose(np.linalg.norm(exported, axis=1), 1, atol=1e-5))
                    clustering = json.loads((directory / "hdbscan_summary.json").read_text())
                    self.assertEqual(clustering["embedding_model"], cls.__name__)
                    self.assertIn(cls.__name__, clustering["input"])
            complex_dir = output / "complex" / "seed_43"
            environment["CHECKPOINT_EPOCHS"] = ""
            control = Path(temporary) / "without_intermediate"
            execute(["app.ml.run_pipeline", "--model", "TransE", "--data-dir", str(control),
                     "--input-dir", str(source), "--seed", "43", "--embedding-dim", "8", "--epochs", "2", "--steps", "train"])
            self.assertTrue(np.array_equal(np.load(control / "artist_embeddings.npy"),
                                           np.load(output / "transe" / "seed_43" / "artist_embeddings.npy")))
            execute(["app.ml.run_pipeline", "--model", "ComplEx", "--data-dir", str(complex_dir),
                     "--input-dir", str(source), "--steps", "project", "materialize", "profile"])
            for dimension in (2, 3):
                frame = pd.read_parquet(complex_dir / f"artist_map_{dimension}d.parquet")
                self.assertEqual(len(frame), 30)
                self.assertTrue(np.isfinite(frame[["x", "y", "z"][:dimension]]).all().all())
            original_hash = hashlib.sha256((complex_dir / "artist_embeddings.npy").read_bytes()).hexdigest()
            result = execute(["app.ml.run_pipeline", "--model", "ComplEx", "--data-dir", str(complex_dir),
                              "--input-dir", str(source), "--steps", "train"], success=False)
            self.assertIn("already exist", result.stderr)
            self.assertEqual(hashlib.sha256((complex_dir / "artist_embeddings.npy").read_bytes()).hexdigest(), original_hash)
            invalid = Path(temporary) / "invalid_dimension"
            execute(["app.ml.run_pipeline", "--model", "RotatE", "--embedding-dim", "7",
                     "--data-dir", str(invalid), "--input-dir", str(source), "--steps", "train"], success=False)
            self.assertFalse(invalid.exists())

    def test_complete_pipeline_uses_isolated_output_directory(self):
        nodes, edges = snapshot()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            input_directory = directory / "input"
            input_directory.mkdir()
            nodes.to_parquet(input_directory / "nodes.parquet")
            edges.to_parquet(input_directory / "edges.parquet")
            environment = {**os.environ, "ML_DATA_DIR": temporary, "TRAIN_EPOCHS": "2",
                           "KGE_MODEL": "TransE", "KGE_EMBEDDING_DIM": "8", "TRAIN_BATCH_SIZE": "32",
                           "ML_INPUT_DIR": str(input_directory),
                           "HDBSCAN_MIN_CLUSTER_SIZE": "5", "HDBSCAN_MIN_SAMPLES": "2",
                           "HDBSCAN_USE_PCA": "false", "UMAP_N_NEIGHBORS": "5",
                           "INCLUDE_COEXHIBITIONS": "false",
                           "NEGATIVE_SAMPLER": "pseudo_typed",
                           "TORCH_NUM_THREADS": "1", "ML_DEVICE": "cpu"}
            result = subprocess.run(
                [sys.executable, "-m", "app.ml.run_pipeline", "--steps", "prepare", "train",
                 "compare_pca", "cluster", "project", "materialize", "profile"],
                env=environment, capture_output=True, text=True, timeout=180,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue((input_directory / "triples.npy").exists())
            self.assertFalse((input_directory / "artist_embeddings.npy").exists())
            training = json.loads((directory / "training_final.json").read_text())
            self.assertEqual(training["negative_sampler"], "PseudoTypedNegativeSampler")
            self.assertEqual(training["negative_sampler_key"], "pseudo_typed")
            embeddings = np.load(directory / "artist_embeddings.npy")
            self.assertEqual(embeddings.shape, (30, 8))
            self.assertTrue(np.allclose(np.linalg.norm(embeddings, axis=1), 1, atol=1e-5))
            for dimensions in (2, 3):
                frame = pd.read_parquet(directory / f"artist_map_{dimensions}d.parquet")
                self.assertEqual(len(frame), 30)
                self.assertTrue(np.isfinite(frame[["x", "y"]]).all().all())
                self.assertTrue(np.array_equal(frame.artist_index, np.arange(30)))
            comparison = json.loads((directory / "pca_comparison.json").read_text())
            self.assertEqual(set(comparison["variants"]), {"raw", "pca"})
            self.assertEqual(len(comparison["variants"]["raw"]["subsample_ari_including_noise"]), 3)
            self.assertEqual(json.loads((directory / "projection_summary.json").read_text())["input_mode"], "raw")
            environment.update(HDBSCAN_USE_PCA="true", HDBSCAN_PCA_COMPONENTS="4")
            result = subprocess.run(
                [sys.executable, "-m", "app.ml.run_pipeline", "--steps", "cluster", "project", "materialize", "profile"],
                env=environment, capture_output=True, text=True, timeout=180,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            projection = json.loads((directory / "projection_summary.json").read_text())
            self.assertEqual(projection["input_mode"], "pca")
            self.assertEqual(projection["projection_input_dimension"], 4)
            for step in ("prepare", "export"):
                protected = subprocess.run(
                    [sys.executable, "-m", "app.ml.run_pipeline", "--steps", step],
                    env=environment, capture_output=True, text=True, timeout=60,
                )
                self.assertNotEqual(protected.returncode, 0)
                self.assertIn("already exist", protected.stderr)
            environment["INCLUDE_COEXHIBITIONS"] = "true"
            fresh_input = directory / "with_coexhibitions"
            fresh_input.mkdir()
            nodes.to_parquet(fresh_input / "nodes.parquet")
            edges.to_parquet(fresh_input / "edges.parquet")
            environment["ML_INPUT_DIR"] = str(fresh_input)
            result = subprocess.run(
                [sys.executable, "-m", "app.ml.run_pipeline", "--steps", "prepare"],
                env=environment, capture_output=True, text=True, timeout=60,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads((fresh_input / "prepare_summary.json").read_text())["excluded_relations"], ["MEMBER_OF"])


if __name__ == "__main__":
    unittest.main()
