"""Render the measured experiment results as a readable Markdown report."""

from pathlib import Path
import json
import statistics

ROOT = Path(__file__).resolve().parent


def number(value, digits=3, percent=False):
    if value is None:
        return "—"
    return f"{value * (100 if percent else 1):.{digits}f}" + ("%" if percent else "")


def table(headers, rows):
    return "\n".join([
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
        *("| " + " | ".join(str(value) for value in row) + " |" for row in rows),
    ])


def main():
    summary = json.loads((ROOT / "evaluation_summary.json").read_text())
    protocol = json.loads((ROOT / "protocol.json").read_text())
    context = json.loads((ROOT / "data_context.json").read_text())
    recommendation_path = ROOT / "recommendation.md"
    recommendation = (
        recommendation_path.read_text(encoding="utf-8").strip()
        if recommendation_path.exists()
        else "Pending completion and inspection of all twelve runs. This report generator does not declare a winner automatically."
    )
    summaries = {(row["model"], row["representation"]): row for row in summary["summary"]}
    models = protocol["models"]
    raw_rows, sensitivity_rows, training_rows = [], [], []
    for model in models:
        reports = [json.loads(path.read_text()) for path in (ROOT / "evaluation" / model.lower()).glob("seed_*/evaluation.json")]
        for representation in protocol["preprocessing"]:
            row = summaries.get((model, representation))
            if row is None:
                continue
            clustered_seeds = sum(report["representations"][representation]["cluster_count"] > 0 for report in reports)
            values = [
                model, representation, f"{row['completed_seeds']} / {clustered_seeds}", number(row["cluster_count_mean"], 1),
                number(row["noise_fraction_mean"], 1, True),
                number(row["largest_cluster_fraction_mean"], 1, True),
                number(row["silhouette_l2_mean"]), number(row["subsample_jaccard_mean_mean"]),
                number(row["cross_seed_jaccard_mean"]),
                number(row["nearest10_shared_exhibition_mean"], 1, True),
            ]
            sensitivity_rows.append(values)
            if representation == "raw":
                raw_rows.append(values)
        if reports:
            times = [report["training_seconds"] / 60 for report in reports]
            training_rows.append([
                model, len(reports), reports[0]["native_dimension"], reports[0]["real_dimension"],
                f"{reports[0]['real_parameter_count']:,}", number(statistics.mean(times), 1),
                number(statistics.stdev(times) if len(times) > 1 else None, 1),
            ])
    headers = ["Model", "Representation", "Seeds: complete / with clusters", "Clusters", "Noise", "Largest cluster / all artists",
               "Silhouette in full L2 space", "Artist-subset Jaccard", "Training-seed Jaccard", "NN10 shared exhibition"]
    content = [
        "# Full-graph comparison of standard PyKEEN models",
        "",
        f"**Status: {summary['status']}; {summary['completed_runs']} of {summary['expected_runs']} training runs evaluated.**",
        "",
        "## Purpose and scope",
        "",
        "This experiment compares the usefulness of TransE, DistMult, ComplEx, and RotatE artist representations for the existing HDBSCAN-based exploratory tool. It is a fixed-training-budget comparison with shared preprocessing checks. It is not an exhaustive hyperparameter search or a universal ranking of KGE algorithms.",
        "",
        "ComplEx here means the standard PyKEEN implementation trained on triples. These scores do not evaluate the earlier custom Attribute-Enhanced ComplEx pipeline, which remains available as a backup.",
        "",
        "The thesis research questions concern exploration and interpretation of artist clusters and comparison with recorded ArtVis groups. The present evidence addresses computational grouping behavior; it does not establish historical group validity or user-study effectiveness.",
        "",
        "## Experimental design",
        "",
        "- One unchanged prepared snapshot: 225,529 connected entities, nine relation types, and 8,150,530 unique directed triples, including 7,723,272 co-exhibition triples (94.8% of the training set).",
        "- The raw snapshot contains 13,973 artist records. The same 708 artists without retained relationships are excluded for all four models; noise and coverage percentages refer to the remaining 13,265 embedded artists.",
        f"- {context['artist_count']:,} artist embeddings. {context['artists_with_exhibition_links']:,} artists have direct exhibition links, covering {context['exhibition_count']:,} exhibitions in this diagnostic.",
        "- Three training seeds per model (41, 42, 43), two full epochs, 2,048 positives per batch, Adam at learning rate 0.001, one pseudo-typed negative per positive, and known-positive Bloom filtering. Each run processes 16,301,060 positives in 7,960 optimizer updates.",
        "- Sixty-four exported real features for every model: 64 native real dimensions for TransE/DistMult, 32 native complex dimensions for ComplEx/RotatE. Complex vectors are exported as concatenated real and imaginary parts, preserving complex Euclidean distance.",
        "- Native PyKEEN model losses, regularization, and constraints are retained. Two CPU threads and native fused Adam are used consistently; two model processes run concurrently. Training wall times therefore depend on shared machine load.",
        "- HDBSCAN uses Euclidean distance, minimum cluster size 50, minimum samples 5, EOM selection, and an exact minimum spanning tree. UMAP is not involved in fitting or evaluating the clusters.",
        "- Every run is checked in raw coordinates, after L2 normalization, and after L2 normalization followed by ten-component PCA. These alternatives were declared before completed model outcomes were available.",
        "",
        "## Raw-embedding baseline",
        "",
        table(headers, raw_rows),
        "",
        "## Shared preprocessing sensitivity analysis",
        "",
        table(headers, sensitivity_rows),
        "",
        "The result tables show means; sample standard deviations and individual runs are retained in the CSV files. Aggregates use the available defined values. Cluster-specific scores are undefined when no group exists; the seed column explicitly shows how many completed seeds produced clusters. Per-run JSON files retain cluster sizes and additional metrics. A dash denotes an undefined or unavailable value, not zero.",
        "",
        "## Model dimensions and measured training cost",
        "",
        table(["Model", "Runs", "Native dimension", "Real dimension", "Real parameters", "Training minutes: mean", "Training minutes: sample SD"], training_rows),
        "",
        "These are concurrent CPU wall times, not dedicated-machine throughput benchmarks. Parameter counts and training-example budgets are recorded separately; equal exported dimension does not imply identical model capacity or convergence.",
        "",
        "## Interpretation of the diagnostics",
        "",
        "- Artist-subset Jaccard uses three 80% subsets, refitting preprocessing and HDBSCAN while holding trained embeddings fixed. Matching is by best cluster overlap, weighted by reference group size, with noise excluded. Groups near the size threshold can disappear under subsampling.",
        "- Training-seed Jaccard matches the three full-data partitions pairwise and averages both matching directions. Losing all groups in one seed counts as zero recovery; two all-noise results do not establish stable clusters. ARI including noise is stored separately and is not substituted for this score.",
        "- Silhouette is sampled on assigned artists and evaluated in each model's full L2-normalized space. Assigned populations can differ, and embedding geometry changes across models, so this is an internal separation diagnostic rather than independent semantic accuracy.",
        f"- NN10 shared exhibition is the fraction of the ten nearest artist neighbors sharing at least one observed exhibition. A common random-other-artist sample gives {context['random_other_artist_shared_exhibition']:.2%} ({context['random_pair_count']:,} pairs). Exhibition relationships are training facts; agreement is descriptive reconstruction, not held-out prediction accuracy.",
        "- Approximate HDBSCAN relative validity, persistence, and assignment strengths are recorded as diagnostics. They are not calibrated probabilities of historical correctness and do not provide a standalone winner rule.",
        "- Within-cluster exhibition agreement samples 20,000 uniformly selected assigned artists and a different, uniformly selected member of each artist's group. Its comparison baseline selects a different artist from the same assigned population. This weights groups by their artist count rather than their number of possible pairs.",
        "- Cluster coverage, resolution, repeatability, and descriptive exhibition profiles must be assessed together. Many assigned points or a single large stable group alone do not demonstrate useful grouping for the tool.",
        "- The numerical training losses belong to different objectives and scales. They are recorded for each run, but are not compared across model families to choose a winner.",
        "",
        "## Limitations and pending evaluation",
        "",
        "The external artist reference labels requested from the supervisors are not available. No supervised group agreement or held-out link-prediction results are claimed. Recorded MEMBER_OF relationships are included in training and cannot simply be relabeled as an independent test set.",
        "",
        "The learning rate and two-epoch training budget are fixed, not individually optimized. Model defaults differ, so results support conclusions about these tested configurations and downstream representations. A poor result here does not establish that an algorithm is generally unsuitable or cannot improve with further tuning.",
        "",
        "## Reproducibility and artifacts",
        "",
        "- `protocol.json`: predeclared data, budgets, seeds, preprocessing, hardware policy, and optimizer setting.",
        "- `source/` and `source_sha256.json`: source snapshot used at the beginning of training.",
        "- `evaluation_runs.csv`: individual model/seed/representation results.",
        "- `evaluation_summary.csv` and `evaluation_summary.json`: aggregated metrics and standard deviations.",
        "- `cross_seed_stability.csv`: individual seed-pair comparisons.",
        "- `evaluation/<model>/seed_<seed>/evaluation.json`: full metrics, sampled stability, cluster sizes, and exhibition descriptions.",
        "- `real_models/` and `complex_models/`: model checkpoints, embeddings, training settings, hashes, and raw clustering results.",
        "- `completion.json`, `integrity_checks.json`, and `api_checks.json`: completed-artifact validation, backup checks, and application API checks. The small evidence bundle in `experiments/kge_comparison_2026-11-09/` preserves reports and scripts outside ignored data directories.",
        "",
        "Earlier incomplete unfused-Adam workers were stopped for a measured CPU execution improvement and retained in the sibling `full_2026-11-09_unfused_pilot/`. They are excluded from the comparison. Application artifacts and both previous ML backups are retained independently; no model is promoted by this experiment.",
        "",
        "## Recommendation",
        "",
        recommendation,
        "",
    ]
    (ROOT / "report.md").write_text("\n".join(content), encoding="utf-8")
    print(f"Wrote {ROOT / 'report.md'} ({summary['completed_runs']}/12 runs).")


if __name__ == "__main__":
    main()
