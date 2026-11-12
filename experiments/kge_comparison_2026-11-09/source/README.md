# Offline artist-embedding pipeline

```text
Neo4j snapshot → unique graph triples → standard PyKEEN model
                                           ├─ HDBSCAN → artist groups
                                           └─ UMAP → 2D/3D views
```

The supported models are **TransE, DistMult, ComplEx, and RotatE**, using their
standard PyKEEN implementations in one shared trainer (`train_kge.py`). The
application currently displays the verified TransE run described below; adding
the alternatives does not retrain or replace that run.

The active TransE configuration includes `CO_EXHIBITED` and uses PyKEEN's built-in
`PseudoTypedNegativeSampler`. HDBSCAN and UMAP receive the full 64-dimensional
artist embeddings. PCA is optional and disabled by default. Node properties
provide names and context; all four models train on triples only.

## Select a model and keep runs separate

Use a fresh output directory and reuse one prepared snapshot. For example:

```bash
docker compose exec backend python -m app.ml.run_pipeline \
  --model ComplEx --input-dir /app/app/ml/data \
  --data-dir /app/app/ml/data_runs/complex_seed43 \
  --seed 43 --embedding-dim 64 --epochs 2 \
  --steps train cluster project materialize profile
```

Replace `ComplEx` with `TransE`, `DistMult`, or `RotatE` and choose a different
output directory. Training refuses to overwrite an existing model, embedding
array, or completed training report. Export/preparation require matching input
and output directories; `--input-dir` with a separate output directory reuses
already prepared data starting at training. The input snapshot is read only.
The API continues to serve `data/`; no model is selected or promoted automatically.

`--embedding-dim` and `KGE_EMBEDDING_DIM` count **exported real features**:

| Model | Native PyKEEN dimension at a setting of 64 | Exported representation |
| --- | ---: | --- |
| TransE | 64 real | 64 real values |
| DistMult | 64 real | 64 real values |
| ComplEx | 32 complex | 32 real parts followed by 32 imaginary parts |
| RotatE | 32 complex | 32 real parts followed by 32 imaginary parts |

Concatenation preserves complex Euclidean distances; imaginary parts are never
discarded. Complex models require an even real dimension. Native dimensions,
exported dimensions, parameter counts, input SHA-256 hashes, actual losses,
sampling settings, seeds, and library versions are recorded for each run.
Equal real dimension does not imply identical total parameter count or model capacity.

Each model retains its own PyKEEN loss, regularization, and constraints. TransE
and DistMult constrain entity L2 norms; ComplEx and RotatE do not impose that
entity constraint by default. Export checks finite, nonzero vectors for all
models and unit norms where required. No additional offline normalization is
applied. Norms and model-specific defaults must be considered when comparing
Euclidean clustering across models.

## Comparison table

An optional runner trains and clusters all four models in separate processes
and directories, using the same prepared triples and specified seeds:

```bash
docker compose exec backend python -m app.ml.compare_models \
  --input-dir /app/app/ml/data \
  --output-dir /app/app/ml/data_comparisons/initial_four_models \
  --models TransE DistMult ComplEx RotatE \
  --seeds 41 42 43 --embedding-dim 64 --epochs 2
```

The example is an **initial fixed-settings comparison**, not a recommendation
that two epochs or the same learning rate optimize every model. A final method
selection needs a documented, comparable tuning budget and agreed evaluation
criteria. The runner does not search parameters or declare a winner.

`comparison.csv` contains one row per model and seed with training time, dimensions,
parameter count, clustering settings, cluster count, noise fraction, sampled
silhouette, approximate relative validity, and persistence. `comparison.json`
contains input hashes, per-model means and sample standard deviations, run paths,
status, and limitations. Missing or undefined metrics remain empty/null, never zero.
Completed rows remain available if a subsequent run fails. Existing comparison
directories are not overwritten.

The runner performs training and clustering only. Use the same run directory with
`--steps project materialize profile` for map/profile exports. The optional
`assess_clustering.py` can additionally validate individual runs under subsampling.
No supervised scores are generated: the reference artist groups and their
evaluation protocol have not been supplied. No held-out link-prediction scores
are claimed. Labels, label overlap, training leakage, and treatment of noise must
be resolved before adding supervised group evaluation.

## Run

For a fresh data directory, from the project directory with the development backend running:

```bash
docker compose exec backend python -m app.ml.run_pipeline
```

To prepare/train an untrained directory containing an existing node/edge snapshot:

```bash
docker compose exec backend python -m app.ml.run_pipeline --steps prepare train cluster project materialize profile
```

Only export needs database credentials. Subsequent steps operate offline.
`ML_DATA_DIR` selects the output directory; `ML_INPUT_DIR` optionally selects a
separate prepared snapshot. Both default to `backend/app/ml/data/`. CLI path/model
arguments override environment variables. Use fresh output directories for new
training runs and execute dependent steps in order.

## Selected settings

| Setting | Default |
| --- | --- |
| `KGE_MODEL` | TransE |
| `KGE_EMBEDDING_DIM` | 64 exported real features |
| `INCLUDE_COEXHIBITIONS` | true |
| `NEGATIVE_SAMPLER` | pseudo_typed |
| `NEGATIVES_PER_POSITIVE` | 1 |
| `TRAIN_EPOCHS` | 2 |
| `TRAIN_BATCH_SIZE` | 2048 |
| `LEARNING_RATE` | 0.001, Adam |
| `ML_RANDOM_SEED` | 43 |
| `ML_DEVICE` | auto; the verified run used CPU |
| `TORCH_NUM_THREADS` | 4 |
| `HDBSCAN_MIN_CLUSTER_SIZE` | 50 |
| `HDBSCAN_MIN_SAMPLES` | 5 |
| `HDBSCAN_CLUSTER_SELECTION_METHOD` | eom |
| `HDBSCAN_USE_PCA` | false |
| `HDBSCAN_PCA_COMPONENTS` | 10, when PCA is enabled |
| `UMAP_N_NEIGHBORS` | 30 |
| `UMAP_MIN_DIST` | 0.10 |

`TRANSE_EMBEDDING_DIM` remains a compatibility fallback when `KGE_EMBEDDING_DIM`
is absent. The model-specific settings below describe the active TransE baseline,
not model-independent optimal hyperparameters.

TransE uses L1 scoring distance and PyKEEN's standard margin-ranking loss and
unit-L2 entity constraint. Known positive triples are filtered using PyKEEN's
Bloom filter. Pseudo-typed sampling selects replacements from entities observed
in the same relation role. For this graph, it avoids most type-incompatible
Artist–Artist corruptions produced by uniform sampling over every entity.
Filtering removes known positives; corrupted triples remain assumed negatives,
not established historical absences. [PyKEEN sampling documentation](https://pykeen.readthedocs.io/en/stable/reference/negative_sampling.html)

There is no attribute encoder, custom embedding model, relation-specific sampling
cap, early stopping, or parameter search inside the default pipeline. These
settings are a tested working configuration, not a globally optimal model.

## Data handling

Training retains the eight supported node types and unique directed triples.
Exact duplicates and co-exhibition self-pairs are excluded. In this snapshot,
adding `CO_EXHIBITED` preserves the baseline entity population and existing IDs. Both observed directions
of the co-exhibition relation are retained, without generating extra inverse types.

The verified snapshot contains 9,509,252 stored co-exhibition edges, corresponding
to 7,723,272 unique directed triples. With the other relations, training uses
8,150,530 triples, 225,529 connected entities, and nine relation types. Two complete
passes process 16,301,060 positive examples in 7,960 optimizer updates.

All co-exhibition pairs in this snapshot can be recovered through a shared
exhibition. Their explicit inclusion nevertheless changes the training objective
and the relative frequency of artist relationships. Logical derivability did not
make their removal equivalent for learning. Co-exhibitions constitute 94.8% of
retained triples; this weighting is an explicit limitation of the chosen setup.

Entities without retained relationships receive no displayed embedding. There
are 13,265 embedded artists; 708 artists without such relationships are excluded.
Their records remain in the raw snapshot and the live graph. The active TransE
export has finite unit-norm vectors. No additional L2-normalization pass is applied offline.

## Verified result, 2026-11-05

The regular pipeline was trained from scratch with seed 43 under PyKEEN 1.11.1
and PyTorch 2.15.0. It produced:

- 17 clusters containing 5,586 artists, or 42.11% of the embedded population;
- 7,679 noise points, or 57.89%, retained in the application;
- cluster sizes from 52 to 1,172 artists;
- a mean size-weighted matched Jaccard of 0.875 over ten 80% artist subsets;
- shared exhibitions for 79.19% of the ten nearest neighbors, compared with
  4.39% for random other artists.

Profiles have recognizable exhibition-network contexts. The largest group is
associated with the London Salon of the Allied Artists' Association; other groups
connect to the Juryfreie Kunstschau, Italian exhibitions, and Belgian salons.
These are descriptive graph patterns, not reference labels for historical schools.

A separate run with seed 42 and controlled shared initialization also produced
17 groups at the selected settings. Size-weighted best Jaccard matching between
the two full partitions is approximately 0.70 in each direction. Broad structure
recurs, but membership boundaries and several smaller groups depend on training
initialization. Individual group stability values are included in the validation
file; the aggregate is not a confidence probability for each group.

## Why PCA is disabled

Ten components were tested explicitly. On the original uniformly sampled models,
they still produced only noise at 50/10. After correcting the sampling and retaining
co-exhibitions, the full representation gave a better coverage/stability trade-off
than the tested ten-component projection.

For the final seed-43 model at the same 50/5 HDBSCAN settings:

| Representation | Clusters | Noise | Mean subsample ARI, including noise |
| --- | ---: | ---: | ---: |
| Full 64 dimensions | 17 | 57.89% | 0.857 |
| PCA, ten components | 17 | 65.72% | 0.806 |

PCA with 95% retained variance and 32/16 components was also examined. Some
projections reduced noise by selecting one large group, which did not provide
the desired resolution of exhibition-network patterns. No representation wins
every internal metric; selection considers coverage, group sizes, stability,
original-space separation, and graph context together.

Optional PCA uses full SVD without whitening, scaling, or extra normalization.
When enabled, UMAP reuses the fitted clustering PCA model. An embedding fingerprint
prevents a stale clustering/PCA model from being used with newly trained vectors.
HDBSCAN always operates before UMAP; it never clusters the displayed coordinates.

## Validation and reproducibility

`compare_pca.py` compares fixed representations. `assess_clustering.py` performs an
optional bounded comparison and validation, outside the application pipeline.
The refinement examined PCA dimensions 5/10/15, minimum group sizes 30/50, and
minimum samples 3/5/10, followed by a targeted EOM/leaf and full-space comparison.

Validation refits HDBSCAN and optional PCA on ten random 80% artist subsets;
the trained embeddings remain fixed within this test. Each
reference cluster is matched to the repeated group with greatest Jaccard overlap;
noise is excluded. Individual cluster means and a size-weighted summary are stored.
This follows the cluster-matching principle discussed by
[Hennig (2007), DOI 10.1016/j.csda.2006.11.025](https://doi.org/10.1016/j.csda.2006.11.025),
with [the author's full-text preprint](https://www.homepages.ucl.ac.uk/~ucakche/papers/clusta.pdf).
The subset fraction and weighted summary are project-specific choices. Small
groups close to the size threshold can disappear under subsetting.

Stability is one diagnostic, not proof of domain validity. The exhibition-agreement
measures use training facts and are not independent prediction accuracy. No
held-out link-prediction performance or superiority over other embedding models
is claimed. [Cluster stability documentation](https://search.r-project.org/CRAN/refmans/fpc/html/clusterboot.html)

Important artifacts include:

- `prepare_summary.json`: counts, relation selection, and snapshot SHA-256 hashes;
- `training_final.json`, `transe.pt`: settings, versions, losses, and model state;
- `artist_embeddings.npy`, `artist_metadata.csv`: aligned vectors and metadata;
- `artist_clusters.csv`, `hdbscan_summary.json`, `cluster_profiles.json`: clustering;
- `artist_map_2d.parquet`, `artist_map_3d.parquet`: application maps;
- `cluster_validation.json`: subsampling, per-group, and cross-initialization checks;
- `pca_comparison.json`: the final-model PCA comparison;
- `runtime_requirements.txt`: the installed environment used for the verified run.

The original Attribute-Enhanced ComplEx directory remains unchanged in
`../ml_backup_attribute_complex_2026-11-05/`. The earlier TransE models, comparisons,
and documentation are preserved in `data_baseline_before_refinement_2026-11-05/`.
Before the four-model extension, the TransE source and active artifacts were also
copied to `../ml_backup_transe_2026-11-09/`; its `backup_manifest.json` records
43 files checked against the original with SHA-256. Earlier backups remain intact.
Historical comparison scripts require that baseline's inputs and its original
HDBSCAN settings; they are not part of the selected pipeline.

Run regression checks from PowerShell in the project directory:

```powershell
Get-Content -Raw backend/tests/test_ml_pipeline.py | docker compose exec -T backend python -
```

They use temporary data and cover preparation, stable IDs, optional co-exhibitions,
complete map export, shared PCA, and non-degenerate stability scoring. All four
models are trained on a small fixture, and their exported vectors are checked
against reloaded native PyKEEN checkpoints. Tests also cover imaginary parts,
shared input hashes, isolated comparison outputs, and overwrite protection.

## Technical references

- [Bordes et al. (2013), Translating Embeddings for Modeling Multi-relational Data](https://proceedings.neurips.cc/paper/2013/hash/1cecc7a77928ca8133fa24680a88d2f9-Abstract.html)
- [PyKEEN TransE defaults](https://pykeen.readthedocs.io/en/stable/api/pykeen.models.TransE.html)
- [PyKEEN DistMult defaults](https://pykeen.readthedocs.io/en/stable/api/pykeen.models.DistMult.html)
- [PyKEEN ComplEx defaults](https://pykeen.readthedocs.io/en/stable/api/pykeen.models.ComplEx.html)
- [PyKEEN RotatE defaults](https://pykeen.readthedocs.io/en/stable/api/pykeen.models.RotatE.html)
- [PyKEEN PseudoTypedNegativeSampler](https://pykeen.readthedocs.io/en/stable/api/pykeen.sampling.PseudoTypedNegativeSampler.html)
- [HDBSCAN parameter selection](https://hdbscan.readthedocs.io/en/latest/parameter_selection.html)
- [scikit-learn PCA](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html)
- [UMAP parameters](https://umap-learn.readthedocs.io/en/latest/parameters.html)

The thesis text still describes the previous method and needs a separate revision.
No thesis chapter was changed during this implementation work.
