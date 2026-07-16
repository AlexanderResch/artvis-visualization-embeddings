import argparse

from collections.abc import (
    Callable
)

from app.ml.cluster_artists import (
    run as run_clustering
)

from app.ml.evaluate_attribute_complex import (
    run as run_evaluation
)

from app.ml.export_snapshot import (
    run as run_export
)

from app.ml.extract_artist_embeddings import (
    run as run_extraction
)

from app.ml.materialize_map import (
    run as run_materialization
)

from app.ml.prepare_training_data import (
    run as run_preparation
)

from app.ml.profile_clusters import (
    run as run_profiles
)

from app.ml.project_umap import (
    run as run_projection
)

from app.ml.train_attribute_complex import (
    run as run_training
)


def train_evaluation() -> None:
    run_training(
        "evaluation"
    )


def train_final() -> None:
    run_training(
        "final"
    )


STEPS: dict[
    str,
    Callable[[], None]
] = {
    "export": (
        run_export
    ),

    "prepare": (
        run_preparation
    ),

    "train_evaluation": (
        train_evaluation
    ),

    "evaluate": (
        run_evaluation
    ),

    "train_final": (
        train_final
    ),

    "extract": (
        run_extraction
    ),

    "cluster": (
        run_clustering
    ),

    "project": (
        run_projection
    ),

    "materialize": (
        run_materialization
    ),

    "profile": (
        run_profiles
    ),
}


DEFAULT_STEPS = list(
    STEPS
)


def main() -> None:
    parser = (
        argparse.ArgumentParser(
            description=(
                "Run the ArtVis "
                "Artist embedding "
                "pipeline"
            )
        )
    )

    parser.add_argument(
        "--steps",

        nargs="+",

        choices=list(
            STEPS
        ),

        default=(
            DEFAULT_STEPS
        ),

        help=(
            "Pipeline steps in "
            "execution order"
        ),
    )

    arguments = (
        parser.parse_args()
    )

    for step_name in (
            arguments.steps
    ):
        print(
            f"\n===== "
            f"{step_name} "
            f"====="
        )

        STEPS[
            step_name
        ]()


if __name__ == "__main__":
    main()