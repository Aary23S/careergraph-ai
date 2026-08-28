"""Phase 4G dataset builder CLI.

    python -m app.pipelines.build_dataset --full
    python -m app.pipelines.build_dataset --incremental
    python -m app.pipelines.build_dataset --full --dataset career-opportunity-ranking --version v1

Requires DATABASE_URL (read-only access to the CareerGraph Postgres
database) set in ai-service/.env or the environment -- see
docs/ml-data-pipeline.md.
"""
import argparse
import json
import sys

from app.pipelines.db import PipelineDatabaseError
from app.pipelines.leakage import LeakageError
from app.pipelines.pipeline import DEFAULT_DATASET_NAME, run_pipeline


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Build a versioned CareerGraph ML dataset snapshot.")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--full", action="store_true", help="Process all applications from the beginning.")
    mode_group.add_argument("--incremental", action="store_true", help="Process only applications since the last checkpoint.")
    parser.add_argument("--dataset", default=DEFAULT_DATASET_NAME, help=f"Dataset name (default: {DEFAULT_DATASET_NAME}).")
    parser.add_argument("--version", default=None, help="Dataset version label (default: auto-generated UTC timestamp).")
    parser.add_argument("--dataset-dir", default="datasets", help="Output root directory (default: ./datasets).")
    parser.add_argument("--batch-size", type=int, default=None, help="DB extraction batch size (default: pipeline_batch_size setting).")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    mode = "incremental" if args.incremental else "full"

    try:
        result = run_pipeline(
            dataset_name=args.dataset,
            dataset_version=args.version,
            mode=mode,
            dataset_dir=args.dataset_dir,
            batch_size=args.batch_size,
        )
    except PipelineDatabaseError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except LeakageError as exc:
        print(f"ERROR: leakage check failed, dataset NOT published: {exc}", file=sys.stderr)
        return 1
    except FileExistsError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"Dataset published: {result['version_dir']}")
    print(json.dumps(result["metadata"], indent=2, default=str))
    print(f"Splits: {result['splits']}")
    print(f"Quality: healthy={result['quality_report']['healthy']}, "
          f"labelDistribution={result['quality_report']['labelDistribution']}")
    print(f"Observability: {result['observability']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
