# Offline embedding pipeline

The pipeline trains the standard PyKEEN implementations of TransE, DistMult,
ComplEx, and RotatE on one prepared Neo4j snapshot. HDBSCAN produces artist
clusters; UMAP produces independent 2D and 3D views for the application.

## Model selection in the application

The Embedding model dropdown selects a complete dataset under
`backend/app/ml/data/models/<model>/`. Every request identifies the selected
model through `X-Embedding-Model` or the `model` query parameter. Maps, clusters,
similarities, artist comparisons, and cached results use the same model.

`GET /models` reports the four model options and whether their application
artifacts are available. A model becomes available after its complete export has
been verified. `manifest.json` records the shared input directory, selected seed,
and preprocessing for each model, plus the comparison metrics. Models are ordered
by descending mean validation pair-F1. The highest-ranked model is the default:
RotatE, followed by TransE, DistMult, and ComplEx in the completed comparison.
Without the released data, `/models` lists unavailable models and model-dependent
endpoints return HTTP 503. `/health` remains available.

Switching models clears selections and filters because cluster IDs belong to
one model. Matching cluster numbers or colors across models do not imply matching
artist groups. Artist similarity uses the full L2-normalized feature vectors;
clustering uses the selected raw/L2/PCA representation.

## Group-reference comparison

The refinement experiment's full training runs were archived outside the
repository during the data-layout cleanup. Its reports, numeric results, and
frozen source remain in `experiments/kge_comparison_2026-11-10/`.
It uses the same structural graph for
all four models, including CO_EXHIBITED and excluding MEMBER_OF. Raw Neo4j
membership records are exported separately and checked against the snapshot.

The reference contains 1,196 artists, 113 groups, and 1,896 memberships.
There are 370 artists with multiple recorded groups. A fixed artist-level split
assigns 598 artists to validation and 598 to test, keeping all memberships of one
artist together. Twenty-one labeled artists have no structural edges after
membership removal. They receive no embedding and remain in reference evaluation
as unassigned artists; 13,244 artists have structural embeddings.

Two training configurations are compared for each model:

| Setting | Native configuration | Adjusted configuration |
| --- | --- | --- |
| Learning rate | 0.001 | 0.01 |
| Regularizer | PyKEEN native settings | Weight 0.001 for DistMult/ComplEx; native type and other settings retained |
| Training checkpoints | Two and four epochs | Two and four epochs |
| Exported real features | 64 | 64 |
| Sampler | Filtered pseudo-typed, one negative per positive | Same |
| Optimizer | Adam, native fused execution | Same |

Complex models use 32 complex dimensions and export both real and imaginary
components. Native PyKEEN losses and constraints are retained. The adjusted
regularized configurations change learning rate and regularizer weight together;
the experiment compares configurations and does not isolate each parameter's
individual effect.

Each checkpoint is evaluated with raw vectors, L2 normalization, and L2 followed
by PCA to ten components. HDBSCAN settings are fixed at minimum cluster size 50,
minimum samples 5, Euclidean distance, and EOM selection with an exact MST.

The highest validation pair-F1 selects one configuration per model. Ties use
subset Jaccard, lower noise, then fewer epochs. Five starts (41–45) evaluate the
selected configuration; seed 41 is the tuning start and four further starts
confirm it. This finite search does not establish global optimality or guarantee
convergence.

A reference pair is positive if two labeled artists share at least one Group.
A predicted positive requires the same non-noise cluster. Pair precision, recall,
and F1 support overlapping memberships. Unlabeled artists are excluded from these
reference comparisons; missing embeddings and noise do not form positive pairs.
ARI and AMI are reported separately on artists with exactly one known group,
using distinct singleton labels for unassigned artists.

The final test labels are evaluated only after all configurations and confirmation
runs are complete. The displayed seed is selected by its average partition
Jaccard against the other four starts, independently of test-label agreement.
Recorded memberships can be incomplete and need not define the only meaningful
exhibition-network grouping. This is a transductive experiment with held-out
membership labels, not a held-out link-prediction benchmark.

Unsupervised diagnostics include cluster coverage and sizes, sampled silhouette
in full normalized feature space, three 80% artist-subset Jaccard repetitions,
and pairwise training-seed stability. Subsampling refits preprocessing and HDBSCAN
with embeddings fixed. Shared exhibitions among ten nearest neighbors and sampled
within-cluster pairs describe training-graph consistency.

### Completed comparison

The versionable evidence is in
[`experiments/kge_comparison_2026-11-10/`](../../../experiments/kge_comparison_2026-11-10/).
Read its [report](../../../experiments/kge_comparison_2026-11-10/report.md) for
definitions and measurements, and its
[recommendation](../../../experiments/kge_comparison_2026-11-10/recommendation.md)
for the preprocessing comparison and interpretation.

All four selected pipelines use L2 followed by PCA to ten components:

| Model | Epochs | Learning rate | Regularizer weight override | Displayed seed |
| --- | --- | --- | --- | --- |
| TransE | 4 | 0.001 | Native default | 45 |
| DistMult | 2 | 0.01 | 0.001 | 44 |
| ComplEx | 4 | 0.001 | Native default | 41 |
| RotatE | 4 | 0.001 | Native default | 43 |

RotatE leads on mean validation pair-F1 and also on mean held-out test pair-F1
(0.180, versus 0.152 for TransE). It has lower mean noise and higher cross-seed
stability. ComplEx produces clusters in only one of five starts; its conditional
internal scores must be read with that failure count. The displayed datasets are
fixed runs, while the result tables summarize all five starts.

The experiment drivers pass the selected settings explicitly. Standalone
`run_pipeline` commands do not read training defaults from the model catalog.
The application ranking and help table use the catalog's recorded comparison
metrics. The model URL preserves an explicit choice; opening the overview without
a model selects the current default. A later interface update changed the
default from TransE to RotatE. The archived experiment retains its original
publication policy and source; training results and frozen selections are unchanged.

## Run a new experiment

### Data directories and releases

All current generated data are under `data/`, excluded by the local `.gitignore`:

```text
data/
  input/          Shared snapshot, prepared graph, and group-reference labels
  models/         manifest.json and rotate/transe/distmult/complex datasets
  runs/           New standalone runs or full comparison experiments
```

`ML_DATA_ROOT` overrides this root; `ML_INPUT_DIR`, `ML_MODEL_ROOT`, and
`ML_DATA_DIR` can override the input, published-model, and run-output paths
individually. Catalog input paths are relative to `ML_DATA_ROOT`. New runs use
`data/runs/standalone/` by default and do not overwrite the selected models.

Package `input/` and `models/` manually for a release, preserving the
`backend/app/ml/data/` directory structure inside the ZIP. See the root
[README](../../../README.md#32-create-a-data-release) for the required layout.
Leave out intermediate runs and backups. Comparison reports and small result
tables stay in Git and are not duplicated in the ZIP.

Older full training runs are in `ML-Archiv/2026-11-12/` next to the local
`Project/` directory. The existing comparison results and frozen source remain
unchanged under `experiments/`.

### Training

Use a fresh output directory. Training refuses to overwrite existing weights,
embeddings, or a completed training record. All steps except Neo4j export are
offline.

Initialize a new comparison using the released prepared input and reference
memberships:

```bash
docker compose exec backend python -m app.ml.refine_models \
  --root /app/app/ml/data/runs/new_group_comparison \
  --input-dir /app/app/ml/data/input --initialize
```

Run one worker per model in separate terminals, replacing TransE with DistMult,
ComplEx, or RotatE. At most four workers should run concurrently on the recorded
machine:

```bash
docker compose exec -e OMP_NUM_THREADS=2 -e MKL_NUM_THREADS=2 \
  -e OPENBLAS_NUM_THREADS=2 backend python -u -m app.ml.refine_models \
  --root /app/app/ml/data/runs/new_group_comparison --model TransE
```

The finalizer waits for all four workers, evaluates the held-out labels, writes
the report, exports the application maps and profiles, verifies their alignment,
then publishes the model catalog:

```bash
docker compose exec backend python -u -m app.ml.finalize_models \
  --root /app/app/ml/data/runs/new_group_comparison --watch
```

The finalizer preserves a frozen selection record when retried. Existing
application datasets from another selected run are protected from replacement.
For a separate publication, pass `-e ML_MODEL_ROOT=/app/app/ml/data/runs/new_group_comparison/models`
to the finalizer; the current dropdown datasets remain protected.

To use a new Neo4j snapshot, first create separate input files:

```bash
docker compose exec -e EXCLUDE_GROUP_MEMBERSHIPS=true backend \
  python -m app.ml.run_pipeline \
  --input-dir /app/app/ml/data/runs/new_dataset/input --steps export prepare

docker compose exec backend python -m app.ml.group_evaluation \
  --export-dir /app/app/ml/data/runs/new_dataset/input \
  --snapshot-dir /app/app/ml/data/runs/new_dataset/input
```

Use that input path when initializing its comparison. Pass
`-e ML_DATA_ROOT=/app/app/ml/data/runs/new_dataset` to its finalizer so the new
catalog and selected models are written beside its input. This complete dataset
can then be packaged manually using the same release layout. Export and
preparation refuse to replace existing artifacts; `--steps prepare` alone
requires matching raw `nodes.parquet` and `edges.parquet` files.

## Artifact formats

| Data | Format | Reason |
| --- | --- | --- |
| Graph tables, artist metadata, cluster assignments, maps, comparison tables, reference memberships | Parquet | Typed columns and compressed storage; no duplicate CSV export |
| Protocols, configuration, small evaluation summaries, descriptive profiles | JSON | Readable nested metadata |
| Embedding matrices, indexed numeric training triples, evaluated partition arrays | NumPy NPY | Direct numerical-array loading |
| Trained model weights | PyTorch PT | Native PyKEEN/PyTorch checkpoint |
| Fitted HDBSCAN/PCA objects | Joblib | Native fitted sklearn-compatible objects |

The CSV reader is retained only for historical runs. New pipeline tables are
written as Parquet. Neo4j's original import CSV files and the catalogue source
file remain external input files. Historical backups and experiment evidence keep
their original formats.

## Other pipeline commands

`run_pipeline.py` supports export, prepare, train, cluster, project, materialize,
and profile. Output and prepared-input directories can be separate:

```bash
docker compose exec backend python -m app.ml.run_pipeline \
  --model RotatE --input-dir /app/app/ml/data/input \
  --data-dir /app/app/ml/data/runs/new_rotate_run \
  --seed 43 --embedding-dim 64 --epochs 4 --steps train
```

`HDBSCAN_NORMALIZE`, `HDBSCAN_USE_PCA`, and `HDBSCAN_PCA_COMPONENTS` control
clustering preprocessing. UMAP reuses the fitted clustering PCA and normalization.
An embedding hash prevents stale clustering/PCA artifacts from being projected
with different vectors. Clustering always precedes projection.

`KGE_REGULARIZER_WEIGHT` optionally overrides the standard regularizer weight
for DistMult/ComplEx. `CHECKPOINT_EPOCHS` saves intermediate epochs without changing
the random training sequence. `compare_models.py` remains available for an isolated
fixed-settings comparison and writes `comparison.parquet`.

## Verification and preserved results

From PowerShell in the project directory:

```powershell
Get-Content -Raw backend/tests/test_ml_pipeline.py | docker compose exec -T backend python -
Get-Content -Raw backend/tests/test_model_catalog.py | docker compose exec -T backend python -
Get-Content -Raw backend/tests/test_model_api.py | docker compose exec -T backend python -
```

The pipeline tests cover structural filtering, label leakage, overlapping groups,
noise handling, complex-vector export, overwrite protection, Parquet outputs, and
unchanged final embeddings when intermediate checkpoints are saved. API tests use
isolated fixtures and concurrent requests to check model-specific maps, neighbors,
cluster inspections, comparisons, and cache isolation.

The earlier fixed-budget comparison remains in
`experiments/kge_comparison_2026-11-09/`. It included membership edges in training
and is not used as an independent group-reference evaluation. Earlier pipeline
backups are not required by the current application. Their retention is managed
separately from the active data release.

The thesis text requires a separate revision after the methodology and final
results are agreed.

## Technical references

- [PyKEEN model tuning](https://pykeen.readthedocs.io/en/stable/tutorial/running_hpo.html)
- [PyKEEN negative sampling](https://pykeen.readthedocs.io/en/stable/reference/negative_sampling.html)
- [scikit-learn clustering evaluation](https://scikit-learn.org/stable/modules/clustering.html#clustering-performance-evaluation)
- [HDBSCAN API](https://hdbscan.readthedocs.io/en/latest/api.html)

