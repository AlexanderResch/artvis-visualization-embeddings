# Group-reference KGE comparison, 10 November 2026

Read [recommendation.md](recommendation.md) for the interpretation and
[report.md](report.md) for the methodology and complete metric definitions.
The comparison evaluates standard PyKEEN TransE, DistMult, ComplEx, and RotatE.
RotatE is the recommendation under the tested configurations and budget.

## Evidence

- `protocol.json` fixes the two training configurations per model, two epoch
  checkpoints, three representations, label split, and selection criteria.
  There are 48 tuning candidates, 24 distinct training jobs, and 20 selected
  pipeline evaluations across seeds 41–45.
- `input_metadata/` contains the Neo4j membership reference, its artist-level
  validation/test split, and graph preparation summaries. Training retains
  CO_EXHIBITED and excludes MEMBER_OF. The reference supports overlapping groups.
- `tuning_results.parquet`, `confirmation_runs.parquet`, `model_summary.parquet`,
  and `cross_seed_stability.parquet` contain the comparison tables. Small nested
  summaries and protocols use JSON. New tables have no duplicate CSV exports.
- `selection_manifest.json` records the model and displayed-run choices frozen
  before test scoring. Individual selections are in each model's directory.
  `publication_protocol.json` fixes the displayed-seed rule. All five starts,
  including all-noise outcomes, contribute to coverage and reference scores.
  The final report adds successful-start counts and a note about conditional
  ComplEx scores after completion; the numeric result tables and frozen report
  generator are unchanged.
- `evaluation/<model>/seed_<seed>/evaluation_final.json` contains every selected
  run's full diagnostics, validation/test metrics, and embedding/checkpoint
  hashes. `training_metadata/` records selected-run settings and losses;
  `tuning_metadata/` records both checkpoints of both training configurations.
- `source/` preserves the 17 ML source files frozen at experiment initialization.
  `publication_source/` preserves the 18 files used for final evaluation and
  application export, including the standalone L2/PCA projection support.
  Both have SHA-256 manifests. Training and configuration selection were not
  changed after seeing test outcomes. `comment_cleanup.json` records the later
  removal of redundant active-code headers and unused imports, with equivalent
  algorithm ASTs; the archived sources remain unchanged.
- `published_metadata/`, `application_manifest.json`, and
  `application_artifact_sha256.json` identify the exact four dropdown datasets.
  The application displays one fixed run per model; the comparison tables report
  means over five starts. For ComplEx the displayed seed is its only start with
  clusters. Its four other all-noise starts remain in the quantitative results.
- `validate_results.py` independently recomputes primary pair counts using set
  intersections for both label splits and all 20 selected runs. It also checks
  input/source hashes, selected training settings, complete seed pairs, native
  checkpoint copies, artist ordering, and published 2D/3D maps.
  `integrity_checks.json` records the successful validation.
- `implementation_checks.json`, `api_checks.json`, and `browser_checks.json`
  record pipeline, API, and browser checks. Backup and historical-result hashes
  are recorded separately. `runtime_requirements.txt` records the Python
  environment. `artifact_sha256.json` fingerprints this evidence bundle.

Large graph snapshots, weights, embedding arrays, evaluated label arrays, and
training logs remain in the ignored local directories:

```text
backend/app/ml/data_supervised_2026-11-10/
backend/app/ml/data_comparisons/groups_2026-11-10/
backend/app/ml/data_models/{transe,distmult,complex,rotate}/
```

This bundle contains about one megabyte of evidence before screenshots; it does
not duplicate the complete dataset or model weights. Earlier results and backups
keep their original formats and contents. No commit or push was performed.

## Reproduction

Use the recorded dependencies and matching prepared-input hashes. The active
[ML README](../../backend/app/ml/README.md) gives the export, preparation, worker,
and finalizer commands. For a new experiment, initialize a fresh output directory,
run one worker per model, and finalize after all four workers complete. The
recorded training uses CPU, two Torch threads per worker, and at most four
concurrent workers.

Use `source/` to inspect the original training/evaluation implementation and
`publication_source/` for the complete compatible publication workflow. The
current active ML source differs from the latter only in the recorded removal
of redundant headers and unused imports. Do not overwrite an existing experiment
or reuse its results as a new run.

To validate the completed local experiment, run from PowerShell in the project
directory:

```powershell
Get-Content -Raw experiments/kge_comparison_2026-11-10/validate_results.py |
  docker compose exec -T backend python - --root /app/app/ml/data_comparisons/groups_2026-11-10
```

The validator needs the local prepared graph and model artifacts. The small
bundle alone is sufficient for reading the recorded tables and configuration,
but does not contain the binary inputs required to train or recompute embeddings.
