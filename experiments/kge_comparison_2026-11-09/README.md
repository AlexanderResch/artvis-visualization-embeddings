# Full-graph KGE comparison, 9 November 2026

This directory contains the small, versionable evidence for a fixed-budget comparison of TransE, DistMult, ComplEx, and RotatE. Read `report.md` for the measured results and the qualified recommendation. No model is activated automatically.

## Evidence

- `protocol.json` is the protocol saved before completed outcomes were available. Its original `status: running` field is preserved; `completion.json` records completion separately.
- `evaluation_runs.csv` contains all 36 model/seed/representation results. `evaluation_summary.csv` and `.json` contain means, sample standard deviations, and training-seed stability.
- `cross_seed_stability.csv` retains each pairwise comparison. All-noise partitions have undefined cluster stability, rather than a misleading perfect score.
- `evaluation/<model>/seed_<seed>/evaluation.json` contains cluster sizes, per-cluster subsampling stability, and descriptive exhibition profiles.
- `training_metadata/<model>/seed_<seed>/` contains the actual training configuration and embedding-export summary.
- `source/` and `source_sha256.json` preserve the pipeline and regression-check source used for the experiment. `analyze.py` and `summarize.py` perform the experiment-specific analysis and reporting. `recommendation.md` records the interpretation separately from metric calculation.
- `runtime_requirements.txt` records the installed Python packages. Training metadata also records the actual PyTorch build, device, thread count, and optimizer implementation.
- `validate_results.py` checks the completed local model artifacts against the protocol, source hashes, common evaluation, and saved raw clustering before writing `completion.json`.
- `integrity_checks.json` records backup and active-artifact checks. `artifact_sha256.json` fingerprints this evidence bundle.

The large local artifacts remain in `backend/app/ml/data_comparisons/full_2026-11-09/`: all twelve checkpoints, embedding arrays, native clustering outputs, and evaluated partition arrays. These are excluded from Git by the existing data-directory rule. Prepared graph inputs remain in `backend/app/ml/data/`; their SHA-256 fingerprints are in the protocol. Reproduction requires these inputs or the same graph snapshot. This evidence directory does not contain the dataset or model weights.

## Reproduction

Use the recorded environment and pipeline source. To reproduce training without touching the active application, choose a **new** directory under `/app/app/ml/data_comparisons/`, such as `replication_2026-11-09`. The example assumes the existing backend container and its `/app/app` bind mount. Run the following two commands in separate terminals to reproduce the two concurrent training workers:

```bash
docker exec -e ML_DEVICE=cpu -e ADAM_FUSED=true -e TORCH_NUM_THREADS=2 \
  -e OMP_NUM_THREADS=2 -e MKL_NUM_THREADS=2 -e OPENBLAS_NUM_THREADS=2 \
  -e LEARNING_RATE=0.001 -e TRAIN_BATCH_SIZE=2048 \
  -e NEGATIVE_SAMPLER=pseudo_typed -e NEGATIVES_PER_POSITIVE=1 \
  -e HDBSCAN_MIN_CLUSTER_SIZE=50 -e HDBSCAN_MIN_SAMPLES=5 \
  -e HDBSCAN_CLUSTER_SELECTION_METHOD=eom -e HDBSCAN_USE_PCA=false \
  artvis-backend python -u -m app.ml.compare_models \
  --input-dir /app/app/ml/data \
  --output-dir /app/app/ml/data_comparisons/replication_2026-11-09/real_models \
  --models TransE DistMult --seeds 41 42 43 --embedding-dim 64 --epochs 2

docker exec -e ML_DEVICE=cpu -e ADAM_FUSED=true -e TORCH_NUM_THREADS=2 \
  -e OMP_NUM_THREADS=2 -e MKL_NUM_THREADS=2 -e OPENBLAS_NUM_THREADS=2 \
  -e LEARNING_RATE=0.001 -e TRAIN_BATCH_SIZE=2048 \
  -e NEGATIVE_SAMPLER=pseudo_typed -e NEGATIVES_PER_POSITIVE=1 \
  -e HDBSCAN_MIN_CLUSTER_SIZE=50 -e HDBSCAN_MIN_SAMPLES=5 \
  -e HDBSCAN_CLUSTER_SELECTION_METHOD=eom -e HDBSCAN_USE_PCA=false \
  artvis-backend python -u -m app.ml.compare_models \
  --input-dir /app/app/ml/data \
  --output-dir /app/app/ml/data_comparisons/replication_2026-11-09/complex_models \
  --models ComplEx RotatE --seeds 41 42 43 --embedding-dim 64 --epochs 2
```

Copy `protocol.json`, `analyze.py`, `summarize.py`, `validate_results.py`, `source_sha256.json`, and the `source/` directory from this evidence directory into the new experiment root on the host. Do not copy old result files. The analysis script derives paths from its own location, so execute that copied script, with `PYTHONPATH=/app`:

```bash
docker exec -e PYTHONPATH=/app -e OMP_NUM_THREADS=2 \
  -e MKL_NUM_THREADS=2 -e OPENBLAS_NUM_THREADS=2 artvis-backend \
  python -u /app/app/ml/data_comparisons/replication_2026-11-09/analyze.py --watch

docker exec artvis-backend \
  python /app/app/ml/data_comparisons/replication_2026-11-09/summarize.py

docker exec -e PYTHONPATH=/app artvis-backend \
  python /app/app/ml/data_comparisons/replication_2026-11-09/validate_results.py
```

The analysis verifies input hashes and identical artist ordering, then checks raw vectors, L2-normalized vectors, and L2 followed by PCA to ten components for every training run. It does not use UMAP coordinates for clustering. It refuses to silently reuse cached evaluations if embeddings or analysis code changed. A recommendation must be reviewed against the newly measured outcomes; the report generator does not select a winner.

The comparison measures internal grouping behavior and descriptive agreement with training-graph facts. It has no external artist reference labels, held-out prediction test, or model-specific hyperparameter search. The standard PyKEEN ComplEx results in this experiment are distinct from the older custom Attribute-Enhanced ComplEx pipeline retained as a backup.
