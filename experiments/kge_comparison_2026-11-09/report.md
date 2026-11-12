# Full-graph comparison of standard PyKEEN models

**Status: complete; 12 of 12 training runs evaluated.**

## Purpose and scope

This experiment compares the usefulness of TransE, DistMult, ComplEx, and RotatE artist representations for the existing HDBSCAN-based exploratory tool. It is a fixed-training-budget comparison with shared preprocessing checks. It is not an exhaustive hyperparameter search or a universal ranking of KGE algorithms.

ComplEx here means the standard PyKEEN implementation trained on triples. These scores do not evaluate the earlier custom Attribute-Enhanced ComplEx pipeline, which remains available as a backup.

The thesis research questions concern exploration and interpretation of artist clusters and comparison with recorded ArtVis groups. The present evidence addresses computational grouping behavior; it does not establish historical group validity or user-study effectiveness.

## Experimental design

- One unchanged prepared snapshot: 225,529 connected entities, nine relation types, and 8,150,530 unique directed triples, including 7,723,272 co-exhibition triples (94.8% of the training set).
- The raw snapshot contains 13,973 artist records. The same 708 artists without retained relationships are excluded for all four models; noise and coverage percentages refer to the remaining 13,265 embedded artists.
- 13,265 artist embeddings. 13,243 artists have direct exhibition links, covering 1,045 exhibitions in this diagnostic.
- Three training seeds per model (41, 42, 43), two full epochs, 2,048 positives per batch, Adam at learning rate 0.001, one pseudo-typed negative per positive, and known-positive Bloom filtering. Each run processes 16,301,060 positives in 7,960 optimizer updates.
- Sixty-four exported real features for every model: 64 native real dimensions for TransE/DistMult, 32 native complex dimensions for ComplEx/RotatE. Complex vectors are exported as concatenated real and imaginary parts, preserving complex Euclidean distance.
- Native PyKEEN model losses, regularization, and constraints are retained. Two CPU threads and native fused Adam are used consistently; two model processes run concurrently. Training wall times therefore depend on shared machine load.
- HDBSCAN uses Euclidean distance, minimum cluster size 50, minimum samples 5, EOM selection, and an exact minimum spanning tree. UMAP is not involved in fitting or evaluating the clusters.
- Every run is checked in raw coordinates, after L2 normalization, and after L2 normalization followed by ten-component PCA. These alternatives were declared before completed model outcomes were available.

## Raw-embedding baseline

| Model | Representation | Seeds: complete / with clusters | Clusters | Noise | Largest cluster / all artists | Silhouette in full L2 space | Artist-subset Jaccard | Training-seed Jaccard | NN10 shared exhibition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TransE | raw | 3 / 3 | 16.0 | 59.2% | 8.7% | 0.175 | 0.876 | 0.688 | 78.0% |
| DistMult | raw | 3 / 3 | 3.0 | 94.2% | 4.5% | -0.002 | 0.128 | 0.019 | 4.4% |
| ComplEx | raw | 3 / 0 | 0.0 | 100.0% | — | — | — | — | 9.5% |
| RotatE | raw | 3 / 3 | 15.0 | 80.5% | 4.4% | 0.402 | 0.867 | 0.674 | 79.1% |

## Shared preprocessing sensitivity analysis

| Model | Representation | Seeds: complete / with clusters | Clusters | Noise | Largest cluster / all artists | Silhouette in full L2 space | Artist-subset Jaccard | Training-seed Jaccard | NN10 shared exhibition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TransE | raw | 3 / 3 | 16.0 | 59.2% | 8.7% | 0.175 | 0.876 | 0.688 | 78.0% |
| TransE | l2 | 3 / 3 | 16.0 | 59.2% | 8.7% | 0.175 | 0.880 | 0.688 | 78.0% |
| TransE | l2_pca10 | 3 / 3 | 17.0 | 67.0% | 7.2% | 0.136 | 0.788 | 0.525 | 69.8% |
| DistMult | raw | 3 / 3 | 3.0 | 94.2% | 4.5% | -0.002 | 0.128 | 0.019 | 4.4% |
| DistMult | l2 | 3 / 3 | 3.0 | 94.2% | 4.5% | -0.002 | 0.128 | 0.019 | 4.4% |
| DistMult | l2_pca10 | 3 / 0 | 0.0 | 100.0% | — | — | — | — | 4.4% |
| ComplEx | raw | 3 / 0 | 0.0 | 100.0% | — | — | — | — | 9.5% |
| ComplEx | l2 | 3 / 3 | 3.0 | 97.0% | 1.6% | -0.000 | 0.102 | 0.008 | 4.5% |
| ComplEx | l2_pca10 | 3 / 1 | 0.7 | 99.5% | 1.1% | 0.004 | 0.000 | 0.000 | 4.3% |
| RotatE | raw | 3 / 3 | 15.0 | 80.5% | 4.4% | 0.402 | 0.867 | 0.674 | 79.1% |
| RotatE | l2 | 3 / 3 | 14.3 | 70.6% | 6.6% | 0.403 | 0.873 | 0.675 | 79.2% |
| RotatE | l2_pca10 | 3 / 3 | 32.3 | 41.3% | 9.5% | 0.232 | 0.881 | 0.696 | 73.0% |

The result tables show means; sample standard deviations and individual runs are retained in the CSV files. Aggregates use the available defined values. Cluster-specific scores are undefined when no group exists; the seed column explicitly shows how many completed seeds produced clusters. Per-run JSON files retain cluster sizes and additional metrics. A dash denotes an undefined or unavailable value, not zero.

## Model dimensions and measured training cost

| Model | Runs | Native dimension | Real dimension | Real parameters | Training minutes: mean | Training minutes: sample SD |
| --- | --- | --- | --- | --- | --- | --- |
| TransE | 3 | 64 | 64 | 14,434,432 | 28.9 | 1.6 |
| DistMult | 3 | 64 | 64 | 14,434,432 | 26.0 | 4.3 |
| ComplEx | 3 | 32 | 64 | 14,434,432 | 26.8 | 0.8 |
| RotatE | 3 | 32 | 64 | 14,434,432 | 23.3 | 2.4 |

These are concurrent CPU wall times, not dedicated-machine throughput benchmarks. Parameter counts and training-example budgets are recorded separately; equal exported dimension does not imply identical model capacity or convergence.

## Interpretation of the diagnostics

- Artist-subset Jaccard uses three 80% subsets, refitting preprocessing and HDBSCAN while holding trained embeddings fixed. Matching is by best cluster overlap, weighted by reference group size, with noise excluded. Groups near the size threshold can disappear under subsampling.
- Training-seed Jaccard matches the three full-data partitions pairwise and averages both matching directions. Losing all groups in one seed counts as zero recovery; two all-noise results do not establish stable clusters. ARI including noise is stored separately and is not substituted for this score.
- Silhouette is sampled on assigned artists and evaluated in each model's full L2-normalized space. Assigned populations can differ, and embedding geometry changes across models, so this is an internal separation diagnostic rather than independent semantic accuracy.
- NN10 shared exhibition is the fraction of the ten nearest artist neighbors sharing at least one observed exhibition. A common random-other-artist sample gives 4.41% (132,650 pairs). Exhibition relationships are training facts; agreement is descriptive reconstruction, not held-out prediction accuracy.
- Approximate HDBSCAN relative validity, persistence, and assignment strengths are recorded as diagnostics. They are not calibrated probabilities of historical correctness and do not provide a standalone winner rule.
- Within-cluster exhibition agreement samples 20,000 uniformly selected assigned artists and a different, uniformly selected member of each artist's group. Its comparison baseline selects a different artist from the same assigned population. This weights groups by their artist count rather than their number of possible pairs.
- Cluster coverage, resolution, repeatability, and descriptive exhibition profiles must be assessed together. Many assigned points or a single large stable group alone do not demonstrate useful grouping for the tool.
- The numerical training losses belong to different objectives and scales. They are recorded for each run, but are not compared across model families to choose a winner.

## Limitations and pending evaluation

The external artist reference labels requested from the supervisors are not available. No supervised group agreement or held-out link-prediction results are claimed. Recorded MEMBER_OF relationships are included in training and cannot simply be relabeled as an independent test set.

The learning rate and two-epoch training budget are fixed, not individually optimized. Model defaults differ, so results support conclusions about these tested configurations and downstream representations. A poor result here does not establish that an algorithm is generally unsuitable or cannot improve with further tuning.

## Reproducibility and artifacts

- `protocol.json`: predeclared data, budgets, seeds, preprocessing, hardware policy, and optimizer setting.
- `source/` and `source_sha256.json`: source snapshot used at the beginning of training.
- `evaluation_runs.csv`: individual model/seed/representation results.
- `evaluation_summary.csv` and `evaluation_summary.json`: aggregated metrics and standard deviations.
- `cross_seed_stability.csv`: individual seed-pair comparisons.
- `evaluation/<model>/seed_<seed>/evaluation.json`: full metrics, sampled stability, cluster sizes, and exhibition descriptions.
- `real_models/` and `complex_models/`: model checkpoints, embeddings, training settings, hashes, and raw clustering results.
- `completion.json`, `integrity_checks.json`, and `api_checks.json`: completed-artifact validation, backup checks, and application API checks. The small evidence bundle in `experiments/kge_comparison_2026-11-09/` preserves reports and scripts outside ignored data directories.

Earlier incomplete unfused-Adam workers were stopped for a measured CPU execution improvement and retained in the sibling `full_2026-11-09_unfused_pilot/`. They are excluded from the comparison. Application artifacts and both previous ML backups are retained independently; no model is promoted by this experiment.

## Recommendation

**For the present exploratory clustering task, prefer the tested RotatE representation with post-training L2 normalization, PCA to ten components, and HDBSCAN at minimum cluster size 50 / minimum samples 5.** This is a recommendation among the observed fixed-budget configurations, not a general claim that RotatE is the best KGE algorithm.

Across three training seeds, this configuration produces 31, 36, and 30 clusters, with a mean of 32.3 (sample SD 3.2). Mean coverage is 58.68%, compared with 40.77% for full-dimensional TransE: an increase of 17.90 percentage points. Noise ranges from 40.23% to 41.91% across RotatE seeds. The increase in coverage does not come from a single catch-all group: the largest group contains 8.63–10.38% of all embedded artists. Artist-subset Jaccard is 0.881 (sample SD 0.021), versus 0.876 (0.039) for TransE. Mean bidirectional training-seed Jaccard is 0.696 versus 0.688. These stability values are similar; three seeds do not establish a statistically significant stability advantage. Several smaller groups remain sensitive to subsetting, as recorded in the per-cluster results.

The preprocessing decision is model-specific. RotatE's mean noise falls from 80.52% in raw coordinates to 70.59% with L2 alone and 41.32% with L2 plus PCA. TransE already exports unit-norm entity vectors; an additional normalization gives the same full-data partitions in all three seeds. Adding ten-component PCA to TransE instead raises mean noise from 59.23% to 67.04% and reduces training-seed Jaccard from 0.688 to 0.525. Ten components retain about 63.45% of normalized variance for RotatE and 38.76% for TransE. Retained variance alone is not a cluster-quality criterion.

There is a neighborhood trade-off: NN10 shared-exhibition agreement is 73.03% in the RotatE PCA space, versus 78.02% for full-dimensional TransE. Full L2-normalized RotatE retains 79.18%. If this model is adopted, clustering can use the PCA representation while artist-neighbor retrieval uses the full normalized 64 real features. This distinction has not been activated in the application by this experiment. The observed within-cluster exhibition agreement is 67.69% for the proposed clustering versus 51.31% for TransE. Exhibition profiles include recurring contexts around the Munich Secession, Salon d'Automne, and Italian and Dutch exhibitions. These measurements describe training-graph relationships, not independent historical group accuracy.

DistMult yields a mean of three raw-space clusters, 94.19% noise, artist-subset Jaccard 0.128, and training-seed Jaccard 0.019. Standard ComplEx yields no raw-space clusters; L2 produces a mean of three clusters with 97.02% noise, artist-subset Jaccard 0.102, and training-seed Jaccard 0.008. Neither is competitive for this clustering task under the tested settings. Longer training and model-specific tuning could change their performance, so these results do not justify rejecting either algorithm in general. They also do not assess the previous custom Attribute-Enhanced ComplEx model.

If a representative RotatE pilot is subsequently needed, seed 43 has the highest mean pairwise partition Jaccard against the other two seeds (0.703). Its proposed representation yields 30 clusters and 7,716 assigned artists out of 13,265, with 41.83% noise. It is selected by similarity to the other runs, rather than by minimum noise. The native checkpoint and evaluated partition are retained under `complex_models/rotate/seed_43/` and `evaluation/rotate/seed_43/`, respectively.

The current application continues to use its previous TransE artifacts. Both ML backups are retained. No commit, push, or model promotion was performed. For a final scientific method selection, the next evidence to add is the supervisors' external reference groups and, if predictive performance is part of the intended evaluation, a separately trained held-out protocol. The present result is a completed internal comparison under a two-epoch budget, without model-specific hyperparameter optimization.
