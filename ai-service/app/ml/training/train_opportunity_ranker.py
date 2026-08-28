"""Phase 4H CLI entrypoint.

    python -m app.ml.training.train_opportunity_ranker [--mode real|development] [options]

`--mode real` (the default) trains against the latest published Phase 4G
dataset version. Given CareerGraph's actual current data (0 accepted, 1
withdrawn application -- see docs/opportunity-ranking.md), this will exit
with a MODEL_NOT_READY result, by design: no model is trained, evaluated, or
registered on statistically meaningless labels.

`--mode development` trains against synthetic, clearly-marked fixtures
(app.ml.training.dev_fixtures) so the pipeline mechanics -- train, evaluate,
serialize, log to MLflow, register as a candidate -- can be exercised and
verified end to end today, without pretending the result is a real,
production-worthy model.

This command never promotes a model to any environment; it only ever
registers (Phase 4E) a `status: candidate` row. Promotion is a separate,
human-operator action (`npm run models:promote`) gated on a passed
evaluation, per Phase 4E's forward-only lifecycle -- nothing in this phase
automates that step.

Exit codes: 0 = trained successfully, 3 = MODEL_NOT_READY (expected,
non-error outcome), 1 = unexpected failure.
"""
import argparse
import json
import sys

from app.ml.training.constants import DATASET_NAME, MIN_NEGATIVE_LABELS, MIN_POSITIVE_LABELS, MIN_TOTAL_LABELS
from app.ml.training.pipeline import MODEL_NOT_READY, run_training
from app.pipelines.db import PipelineDatabaseError
from app.ml.training.data import DatasetNotFoundError


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Train the career-opportunity-ranking model.")
    parser.add_argument("--mode", choices=["real", "development"], default="real")
    parser.add_argument("--dataset", default=DATASET_NAME)
    parser.add_argument("--dataset-version", default=None, help="Specific published version; defaults to the latest.")
    parser.add_argument("--dataset-dir", default="datasets")
    parser.add_argument("--model-version", default=None, help="Defaults to an auto-generated UTC timestamp.")
    parser.add_argument("--models-dir", default="models")
    parser.add_argument("--min-positive", type=int, default=MIN_POSITIVE_LABELS)
    parser.add_argument("--min-negative", type=int, default=MIN_NEGATIVE_LABELS)
    parser.add_argument("--min-total", type=int, default=MIN_TOTAL_LABELS)
    parser.add_argument("--dev-fixture-size", type=int, default=300)
    parser.add_argument("--dev-fixture-seed", type=int, default=42)
    parser.add_argument("--no-register", action="store_true", help="Skip handing the trained model to the Model Registry CLI.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    try:
        result = run_training(
            mode=args.mode,
            dataset_dir=args.dataset_dir,
            dataset_name=args.dataset,
            dataset_version=args.dataset_version,
            model_version=args.model_version,
            models_dir=args.models_dir,
            min_positive=args.min_positive,
            min_negative=args.min_negative,
            min_total=args.min_total,
            register_candidate=not args.no_register,
            dev_fixture_size=args.dev_fixture_size,
            dev_fixture_seed=args.dev_fixture_seed,
        )
    except (DatasetNotFoundError, PipelineDatabaseError) as exc:
        print(f"Training aborted: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # pragma: no cover - defensive top-level catch
        print(f"Training failed unexpectedly: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2, default=str))

    if result["status"] == MODEL_NOT_READY:
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
