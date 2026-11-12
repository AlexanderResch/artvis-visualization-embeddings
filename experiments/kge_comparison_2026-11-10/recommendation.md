# Interpretation and model recommendation

RotatE is the recommended model within the configurations and training budget tested here. It was selected by mean validation pair-F1 before held-out test scores were calculated. It also has the highest mean test pair-F1, the lowest mean noise fraction, and the highest cross-seed cluster Jaccard in this comparison. This is a recommendation for the evaluated embedding-and-clustering pipelines, not a claim that RotatE is universally the best KGE algorithm.

## Evidence across five starts

F1 values are means ± sample standard deviations across seeds 41–45. Noise includes every run. The last column explicitly records complete clustering failures.

| Model | Test pair F1 | Mean noise | Cross-seed Jaccard | Starts with clusters |
| --- | --- | --- | --- | --- |
| TransE | 0.152 ± 0.026 | 51.7% | 0.520 | 5/5 |
| DistMult | 0.071 ± 0.007 | 79.5% | 0.134 | 5/5 |
| ComplEx | 0.021 ± 0.047 | 91.7% | 0.000 | 1/5 |
| RotatE | 0.180 ± 0.025 | 32.6% | 0.786 | 5/5 |

TransE has slightly higher mean pair precision (0.306 versus 0.279 for RotatE), while RotatE has higher recall (0.135 versus 0.102), greater coverage, and higher stability. Consequently, RotatE leads on the predeclared F1 criterion. The standard deviations describe sensitivity to initialization; they are not confidence intervals or a significance test. A pair-F1 of 0.180 is not an artist-classification accuracy of 18%. The known groups are only partially recovered.

ComplEx produces clusters in just one of five starts. Its reported subset Jaccard of 0.823 and silhouette of 0.218 are each conditional on that one successful run; the other four values are undefined. Those conditional means must not be read as evidence of overall stability. Its cross-seed Jaccard is zero. DistMult produces two or three clusters but has weak group agreement and low cross-seed stability. These outcomes apply to the tested settings and budget; they do not isolate architecture from optimization or establish convergence.

RotatE also places 85.6% of its ten-nearest-neighbor pairs in a shared recorded exhibition, compared with 78.3% for TransE. These are descriptive checks against facts used for training, rather than independent prediction results.

## Does PCA help?

This table compares preprocessing at the selected training configuration and epoch for each model, using only validation labels and tuning seed 41. The values are pair-F1 scores.

| Model | Raw vectors | L2 | L2 + PCA10 |
| --- | --- | --- | --- |
| TransE | 0.065 | 0.065 | 0.165 |
| DistMult | 0.020 | 0.020 | 0.061 |
| ComplEx | 0.031 | 0.040 | 0.105 |
| RotatE | 0.028 | 0.063 | 0.155 |

PCA to ten components improves validation group agreement in all four of these comparisons and is therefore retained in all published datasets. It does not improve every diagnostic: for example, TransE subset Jaccard falls from 0.892 without PCA to 0.782 with PCA in the tuning run. The selection follows the declared group-agreement criterion, with stability reported alongside it. The experiment compares these three representations; it does not establish that ten components are universally optimal. The preprocessing ablation uses one tuning seed, while five starts assess the selected pipeline.

TransE and DistMult already export vectors with unit L2 norms, and raw versus additionally normalized vectors yield identical cluster counts and validation pair-F1 at these selected checkpoints. Additional L2 normalization has no material magnitude effect for those exports. The default entity constraints can be inspected in the [PyKEEN TransE source](https://pykeen.readthedocs.io/en/stable/_modules/pykeen/models/unimodal/trans_e.html) and [DistMult documentation](https://pykeen.readthedocs.io/en/stable/api/pykeen.models.DistMult.html). ComplEx and RotatE have varying vector norms; L2 is an evaluated preprocessing choice for them.

## Training settings and displayed datasets

Validation selects four epochs at learning rate 0.001 with native loss/regularization settings for TransE, ComplEx, and RotatE. DistMult selects two epochs at 0.01 with regularizer weight 0.001. The search deliberately contains two configurations per model and two epoch checkpoints. Learning rate and regularization change together in the adjusted regularized models, so their individual effects cannot be separated. Training loss does not rank pipelines with different objectives.

The dropdown uses fixed datasets with seeds TransE 45, DistMult 44, ComplEx 41, and RotatE 43. The displayed seed maximizes mean cluster Jaccard against the other starts; it is not selected for its test score. For ComplEx every defined seed-pair Jaccard is zero, so the declared tie rule selects seed 41, its only start with clusters. Its visible four-cluster map must therefore be considered alongside the four all-noise runs, rather than presented as a stable typical outcome. Application cluster counts describe the displayed run; the comparison tables summarize all five starts.

Configuration and recommendation selection were frozen at 2026-11-10T16:11:01.478411+00:00. No parameters were changed in response to test outcomes. Group memberships are excluded from the training graph, CO_EXHIBITED is retained, and overlapping memberships are scored through shared-group artist pairs. The full definitions, label split, and limitations are in [report.md](report.md). Earlier results and the custom Attribute-Enhanced ComplEx backup use different pipelines and are preserved as historical evidence.
