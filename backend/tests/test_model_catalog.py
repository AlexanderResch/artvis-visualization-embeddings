import unittest
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

import pandas as pd

from app.ml.finalize_models import application_catalog
from app import model_artifacts
from fastapi import HTTPException


class ModelCatalogTest(unittest.TestCase):
    def test_missing_data_and_portable_input_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            models = root / "models"
            models.mkdir()
            with patch.object(model_artifacts, "DATA_ROOT", root), patch.object(model_artifacts, "MODEL_ROOT", models):
                missing = model_artifacts.available_models()
                self.assertEqual(missing["default"], "rotate")
                self.assertFalse(any(row["available"] for row in missing["models"]))
                with self.assertRaises(HTTPException) as unavailable:
                    model_artifacts.resolve_model()
                self.assertEqual(unavailable.exception.status_code, 503)
                manifest = {"default": "rotate", "models": {"rotate": {"input_directory": "input"}}}
                (models / "manifest.json").write_text(json.dumps(manifest))
                self.assertEqual(model_artifacts.resolve_model().input_directory, root / "input")
                manifest["models"]["rotate"]["input_directory"] = "../../outside"
                (models / "manifest.json").write_text(json.dumps(manifest))
                with self.assertRaises(HTTPException) as invalid:
                    model_artifacts.resolve_model()
                self.assertEqual(invalid.exception.status_code, 500)

    def test_ranking_uses_validation_and_keeps_fixed_artifacts(self):
        names = ("TransE", "DistMult", "ComplEx", "RotatE")
        validation = (0.4, 0.2, 0.1, 0.6)
        artifacts = {name.lower(): {"seed": seed, "input_directory": "shared"}
                     for seed, name in enumerate(names, start=41)}
        summaries = [{"model": name, "validation_pair_f1_mean": score,
                      "test_pair_f1_mean": 0.99 if name == "ComplEx" else 0.3,
                      "noise_fraction_mean": 0.5, "cross_seed_jaccard_mean": 0.7,
                      "completed_seeds": 2} for name, score in zip(names, validation, strict=True)]
        runs = pd.DataFrame([{"model": name, "cluster_count": count}
                             for name in names for count in (2, 0 if name == "ComplEx" else 3)])
        result = application_catalog("example", artifacts, summaries, runs)
        self.assertEqual(list(result["models"]), ["rotate", "transe", "distmult", "complex"])
        self.assertEqual(result["default"], "rotate")
        self.assertEqual(result["ranking_metric"], "validation_pair_f1_mean")
        self.assertEqual(result["models"]["complex"]["evaluation"]["clustered_seeds"], 1)
        for rank, entry in enumerate(result["models"].values(), start=1):
            self.assertEqual(entry["rank"], rank)
        for key, original in artifacts.items():
            self.assertEqual(result["models"][key]["seed"], original["seed"])
            self.assertNotIn("rank", original)


if __name__ == "__main__":
    unittest.main()
