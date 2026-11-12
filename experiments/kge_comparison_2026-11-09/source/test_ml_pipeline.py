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
            self.assertEqual(len(pd.read_csv(output / "comparison.csv")), 4)
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
                    complex_model = cls in (ComplEx, RotatE)
                    self.assertEqual(training["model_embedding_dimension"], 4 if complex_model else 8)
                    checkpoint = torch.load(directory / f"{cls.__name__.lower()}.pt", weights_only=True)
                    model = cls(triples_factory=factory, random_seed=43, **checkpoint["model_kwargs"])
                    model.load_state_dict(checkpoint["state_dict"])
                    model.eval()
                    artists = pd.read_csv(directory / "artist_metadata.csv")
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
            nodes.to_parquet(directory / "nodes.parquet")
            edges.to_parquet(directory / "edges.parquet")
            environment = {**os.environ, "ML_DATA_DIR": temporary, "TRAIN_EPOCHS": "2",
                           "KGE_MODEL": "TransE", "KGE_EMBEDDING_DIM": "8", "TRAIN_BATCH_SIZE": "32",
                           "ML_INPUT_DIR": temporary,
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
            environment["INCLUDE_COEXHIBITIONS"] = "true"
            result = subprocess.run(
                [sys.executable, "-m", "app.ml.run_pipeline", "--steps", "prepare"],
                env=environment, capture_output=True, text=True, timeout=60,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads((directory / "prepare_summary.json").read_text())["excluded_relations"], [])


if __name__ == "__main__":
    unittest.main()
