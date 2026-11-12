# Knowledge graph embedding comparison with Neo4j group references

Status: completed. Four standard PyKEEN models, two predefined training configurations per model, checkpoints after two and four epochs, three representations, and five confirmation seeds for each selected configuration.

## Data and evaluation design

The same prepared graph contains 13,244 embedded artists. CO_EXHIBITED is retained. All 1,896 MEMBER_OF relationships are excluded from training; their Group nodes have no remaining structural edges and are not embedded.

Neo4j supplies 1,196 labeled artists in 113 groups. 370 artists have multiple recorded groups. Twenty-one labeled artists have no remaining structural relationships and therefore receive no embedding; they stay in reference evaluation as unassigned artists.

A deterministic artist-level split assigns 598 artists to validation and 598 to test. All memberships of an artist remain in the same split. Validation labels choose configurations. Test agreement is computed only after every configuration is frozen and all confirmation trainings finish. This is a transductive graph experiment with held-out membership labels, not held-out link prediction.

## Training and selection

Each model compares its native PyKEEN settings at learning rate 0.001 with an adjusted configuration at 0.01. The adjusted DistMult and ComplEx runs use regularizer weight 0.001, retaining their native regularizer type and remaining regularizer settings. TransE and RotatE retain their native regularization. The adjusted setting changes two parameters together for regularized models; this experiment does not isolate their individual effects.

All models export 64 real features (64 real dimensions or 32 complex dimensions with both components retained). Training uses CPU, two Torch threads per worker, Adam with native fused execution, batches of 2,048, and one filtered pseudo-typed negative per positive. Four workers can run concurrently. Wall time depends on shared machine load.

The tuning seed is 41. Each of two trainings supplies two- and four-epoch checkpoints. Raw, L2, and L2 followed by ten-component PCA are evaluated at fixed HDBSCAN settings: minimum cluster size 50, minimum samples 5, Euclidean distance, EOM, exact MST. The highest validation pair-F1 wins; ties use subset Jaccard, lower noise, and fewer epochs. The chosen configuration is confirmed with seeds 41–45. The tuning seed is reused as one of five confirmation seeds; four additional starts are independent of that initialization. This is a bounded search, not exhaustive optimization or a guarantee of convergence.

| Model | Learning rate | Regularizer weight override | Epochs | Representation | Displayed seed |
| --- | --- | --- | --- | --- | --- |
| TransE | 0.001 | native default | 4 | l2_pca10 | 45 |
| DistMult | 0.01 | 0.001 | 2 | l2_pca10 | 44 |
| ComplEx | 0.001 | native default | 4 | l2_pca10 | 41 |
| RotatE | 0.001 | native default | 4 | l2_pca10 | 43 |

## Confirmation results

Values are means over five starts. Sample standard deviations and all individual measurements are in the Parquet tables. Undefined cluster-specific scores remain null; no-cluster cases still contribute their full noise fraction and zero pair-F1.

| Model | Clusters | Starts with clusters | Noise | Subset Jaccard | Seed Jaccard | Test pair precision | Test pair recall | Test pair F1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TransE | 27.400 | 5/5 | 51.7% | 0.811 | 0.520 | 0.306 | 0.102 | 0.152 |
| DistMult | 2.200 | 5/5 | 79.5% | 0.540 | 0.134 | 0.066 | 0.077 | 0.071 |
| ComplEx | 0.800 | 1/5 | 91.7% | 0.823 | 0.000 | 0.014 | 0.043 | 0.021 |
| RotatE | 46.600 | 5/5 | 32.6% | 0.884 | 0.786 | 0.279 | 0.135 | 0.180 |

| Model | Test labeled-artist coverage | ARI: single-label subset | AMI: single-label subset |
| --- | --- | --- | --- |
| TransE | 0.324 | 0.097 | 0.173 |
| DistMult | 0.234 | 0.010 | 0.025 |
| ComplEx | 0.103 | 0.007 | 0.023 |
| RotatE | 0.428 | 0.113 | 0.217 |

For ComplEx, subset Jaccard and silhouette are defined for only one start. Its conditional internal-score means must be interpreted together with the four all-noise starts; all five starts contribute to mean noise and reference scores.

## Metric definitions and limits

- Reference pair truth is positive when two labeled artists share at least one recorded Group. A predicted positive requires the same non-noise cluster. All unordered pairs within the respective label split are evaluated exactly. Unlabeled artists do not become negative reference examples. Noise and missing embeddings do not form a shared predicted group. Precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2TP/(2TP+FP+FN); zero-denominator results are set to zero.
- Group memberships overlap, so a disjoint clustering cannot necessarily recover every positive pair without introducing false positives. ARI and AMI are consequently secondary scores on artists with exactly one known group. Each unassigned artist is treated as a distinct singleton for these scores. Counts and coverage accompany the metrics.
- Subset stability averages size-weighted best cluster Jaccard over three fixed 80% artist subsets, refitting preprocessing and clustering with trained embeddings fixed. Seed stability averages best matching in both directions for each of the ten seed pairs. Noise is excluded as a group. Losing all groups in one partition counts as zero recovery; two all-noise partitions have undefined cluster stability.
- Silhouette uses the assigned members of a common 2,000-artist sample, evaluated in full L2-normalized feature space. Assigned populations and learned geometries differ, so this is an internal diagnostic. PCA is full SVD without whitening. UMAP is used only for the display.
- NN10 shared-exhibition agreement uses the selected clustering representation. Application artist similarity uses the full normalized embedding features. The NN10 check and 20,000 sampled within-cluster pairs describe EXHIBITED_AT facts in the training graph. Random within-population pairs provide context. These checks do not establish independent prediction accuracy or historical correctness.
- Recorded memberships can be incomplete and need not define the only meaningful exhibition-network grouping. A low reference score can reflect a different grouping objective as well as poor representations. Cluster coverage, stability, reference agreement, and graph interpretation should be read together.

## Application datasets

Each dropdown option selects one fixed model dataset: embeddings, clusters, 2D/3D maps, profiles, and evaluation metadata. Its displayed seed maximizes mean matched Jaccard against the other confirmation starts, with the smallest seed breaking a tie. No test-label score selects the displayed run. Cluster IDs and UMAP coordinates are local to each model and do not identify equivalent groups across models. The default option remains TransE.

All new tabular artifacts use Parquet. Small configuration/evaluation documents use JSON; NumPy arrays, PyTorch checkpoints, and fitted sklearn/HDBSCAN models retain their native formats. Existing backups and the earlier fixed-budget comparison retain their original files.

## Selection interpretation

The model with the highest mean validation pair-F1 among these frozen configurations is RotatE. This recommendation is recorded before held-out test outcomes are calculated. The test table provides complementary post-selection evidence; no further tuning is performed against those outcomes.

## Reproducibility

protocol.json records the search, label split, input hashes, and selection rule. publication_protocol.json records final model/running-seed policies. Frozen source is in source/. tuning_results.parquet, confirmation_runs.parquet, model_summary.parquet, and cross_seed_stability.parquet retain the numeric evidence. evaluation/<model>/seed_<seed>/evaluation_final.json includes source/checkpoint/embedding fingerprints, validation and test scores. Training logs and binary artifacts remain in the ignored experiment directory. No commit or push was performed.

Technical definitions: [PyKEEN model tuning](https://pykeen.readthedocs.io/en/stable/tutorial/running_hpo.html), [scikit-learn clustering evaluation](https://scikit-learn.org/stable/modules/clustering.html#clustering-performance-evaluation), [HDBSCAN](https://hdbscan.readthedocs.io/en/latest/api.html).
