import concurrent.futures
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd

from app.ml.config import MODEL_ROOT


def main():
    published = json.loads((MODEL_ROOT / "manifest.json").read_text())
    source = MODEL_ROOT / published["default"]
    metadata = pd.read_parquet(source / "artist_clusters.parquet").head(24).copy()
    map2 = pd.read_parquet(source / "artist_map_2d.parquet").head(24).copy()
    map3 = pd.read_parquet(source / "artist_map_3d.parquet").head(24).copy()
    first, second = metadata.id.astype(str).iloc[:2]
    models = ("transe", "distmult", "complex", "rotate")
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        ranking = ("rotate", "transe", "distmult", "complex")
        manifest = {"default": "rotate", "models": {model: {"input_directory": "input", "rank": ranking.index(model) + 1,
                    "evaluation": {"test_pair_f1_mean": 0.1 * (4 - ranking.index(model))}} for model in models}}
        (root / "manifest.json").write_text(json.dumps(manifest))
        for index, model in enumerate(models):
            directory = root / model
            directory.mkdir()
            cluster = 100 + index
            for frame, filename in ((metadata.copy(), "artist_clusters.parquet"),
                                    (map2.copy(), "artist_map_2d.parquet"),
                                    (map3.copy(), "artist_map_3d.parquet")):
                frame["cluster"] = cluster
                frame["is_noise"] = False
                frame["membership_probability"] = 1.0
                frame["outlier_score"] = 0.0
                frame.to_parquet(directory / filename, index=False)
                os.utime(directory / filename, (1700000000, 1700000000))
            vectors = np.random.default_rng(index).normal(size=(len(metadata), 64)).astype(np.float32)
            np.save(directory / "artist_embeddings.npy", vectors)
            os.utime(directory / "artist_embeddings.npy", (1700000000, 1700000000))
            for filename, value in {
                "cluster_profiles.json": {"cluster_count": 1, "clusters": [{"cluster": cluster, "artist_count": len(metadata)}]},
                "hdbscan_summary.json": {"cluster_count": 1, "embedding_model": model, "noise_fraction": 0.0},
                "training_final.json": {"model": model},
            }.items():
                (directory / filename).write_text(json.dumps(value))
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        environment = {**os.environ, "ML_MODEL_ROOT": str(root), "OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1"}
        log = (root / "api.log").open("w")
        server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
                                  env=environment, stdout=log, stderr=subprocess.STDOUT)
        def request(path, model):
            req = Request(f"http://127.0.0.1:{port}{path}", headers={"X-Embedding-Model": model})
            with urlopen(req, timeout=60) as response:
                if path not in {"/health", "/models"}:
                    assert response.headers["X-Embedding-Model"] == model
                return json.loads(response.read())
        try:
            for attempt in range(200):
                if server.poll() is not None:
                    raise AssertionError((root / "api.log").read_text())
                try:
                    request("/health", "transe")
                    break
                except OSError:
                    time.sleep(.1)
            else:
                raise AssertionError("Test API did not start.")

            def verify(model):
                index = models.index(model)
                cluster = 100 + index
                catalog = request("/models", model)
                assert all(row["available"] for row in catalog["models"])
                assert catalog["default"] == "rotate"
                assert [row["id"] for row in catalog["models"]] == list(ranking)
                assert [row["rank"] for row in catalog["models"]] == [1, 2, 3, 4]
                assert catalog["models"][0]["evaluation"]["test_pair_f1_mean"] == 0.4
                for dimension in (2, 3):
                    rows = request(f"/embeddings/{dimension}d?limit=3", model)
                    assert len(rows) == 3 and {row["cluster"] for row in rows} == {cluster}
                summary = request("/clusters", model)
                assert summary["profiles"]["clusters"][0]["cluster"] == cluster
                dashboard = request("/dashboard/options", model)
                assert dashboard["clusters"][0]["cluster"] == cluster
                evaluation = request("/evaluation", model)
                assert evaluation["training_final"]["model"] == model
                neighbors = request(f"/artists/{first}/similar?limit=3", model)
                assert {row["cluster"] for row in neighbors} == {cluster}
                pair = request(f"/artist-comparison?artist_a={first}&artist_b={second}", model)
                assert pair["artist_a"]["cluster"] == cluster and pair["artist_b"]["cluster"] == cluster
                inspection = request(f"/clusters/{cluster}/inspection", model)
                assert inspection["cluster"] == cluster
                return model
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                for model in pool.map(verify, (*models, *reversed(models))):
                    print(f"Verified concurrent model isolation: {model}", flush=True)
            try:
                request("/embeddings/2d?model=../../data", "transe")
                raise AssertionError("Invalid model was accepted.")
            except HTTPError as error:
                assert error.code == 422
            with urlopen(f"http://127.0.0.1:{port}/embeddings/2d?limit=1", timeout=60) as response:
                assert response.headers["X-Embedding-Model"] == "rotate"
                assert json.loads(response.read())[0]["cluster"] == 103
            (root / "rotate/artist_map_3d.parquet").unlink()
            catalog = request("/models", "rotate")
            assert not next(row for row in catalog["models"] if row["id"] == "rotate")["available"]
            try:
                request("/ready", "rotate")
                raise AssertionError("Incomplete model data were marked ready.")
            except HTTPError as error:
                assert error.code == 503
            print("Model-specific maps, neighbors, comparisons, cluster inspections, caches, and invalid selection checks passed.")
        except Exception:
            print((root / "api.log").read_text()[-6000:])
            raise
        finally:
            server.terminate()
            server.wait(timeout=20)
            log.close()


if __name__ == "__main__":
    main()
