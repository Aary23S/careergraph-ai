"""Phase 4G -- pipeline orchestrator.

Wires together: extract -> validate -> transform+feature-engineer -> split
-> version -> publish, with the leakage check run as a hard gate before
publish (a leaky dataset is refused, not published with a warning), and
observability counters tracked throughout (section 13), reusing this
service's existing structured `log_event` convention rather than building a
second observability system.
"""
import time
from datetime import datetime, timezone

from app.logging_config import log_event
from app.pipelines import checkpoint, extract, split as split_stage, versioning
from app.pipelines.db import get_connection, get_latest_applied_migration
from app.pipelines.leakage import check_no_leakage
from app.pipelines.publish import publish_dataset
from app.pipelines.quality import build_quality_report
from app.pipelines.transform import AUDIT_TIMESTAMP_FIELDS, transform_row
from app.pipelines.validate import validate_batch

DEFAULT_DATASET_NAME = "career-opportunity-ranking"


def _collect_lookup_keys(valid_rows):
    user_ids = {row["user_id"] for row in valid_rows if row.get("user_id")}
    embedding_keys = set()
    for row in valid_rows:
        if row.get("job_id"):
            embedding_keys.add(("job", row["job_id"]))
        if row.get("resume_row_id"):
            embedding_keys.add(("resume", row["resume_row_id"]))
    return user_ids, embedding_keys


def run_pipeline(
    dataset_name=DEFAULT_DATASET_NAME,
    dataset_version=None,
    mode="full",
    dataset_dir="datasets",
    batch_size=None,
):
    """`mode` is "full" or "incremental". Returns a result dict with
    `metadata`, `quality_report`, `observability`, and `version_dir`.
    Raises on a genuine hard failure (DB unreachable, leakage detected,
    dataset version already published) -- callers (the CLI) decide how to
    report that."""
    if not dataset_version:
        dataset_version = datetime.now(timezone.utc).strftime("v%Y%m%dT%H%M%SZ")

    start = time.monotonic()
    observability = {
        "rows_processed": 0,
        "rows_accepted": 0,
        "rows_rejected": 0,
        "feature_generation_ms": 0.0,
        "failure_count": 0,
    }

    since = None
    if mode == "incremental":
        since = checkpoint.read_checkpoint(dataset_dir, dataset_name)

    log_event(
        "dataset_pipeline_start",
        dataset=dataset_name,
        version=dataset_version,
        mode=mode,
        since=str(since) if since else None,
    )

    connection = get_connection()
    try:
        source_schema_version = get_latest_applied_migration(connection=connection)

        seen_application_ids = set()
        final_rows = []
        max_prediction_time = None

        for raw_batch in extract.extract_application_batches(since=since, batch_size=batch_size, connection=connection):
            observability["rows_processed"] += len(raw_batch)

            valid_rows, quarantined = validate_batch(raw_batch, seen_application_ids)
            observability["rows_rejected"] += len(quarantined)
            for q in quarantined:
                log_event("dataset_pipeline_quarantine", **q)

            user_ids, embedding_keys = _collect_lookup_keys(valid_rows)
            connections_by_user = extract.fetch_connections_for_users(user_ids, connection=connection)
            embeddings_by_key = extract.fetch_embeddings(embedding_keys, connection=connection)

            for raw_row in valid_rows:
                feature_start = time.monotonic()
                try:
                    final_row = transform_row(raw_row, connections_by_user, embeddings_by_key)
                except Exception as exc:
                    observability["failure_count"] += 1
                    log_event(
                        "dataset_pipeline_row_failure",
                        application_id=raw_row.get("application_id"),
                        error=str(exc),
                    )
                    continue
                finally:
                    observability["feature_generation_ms"] += (time.monotonic() - feature_start) * 1000

                final_rows.append(final_row)
                observability["rows_accepted"] += 1
                if max_prediction_time is None or final_row["prediction_time"] > max_prediction_time:
                    max_prediction_time = final_row["prediction_time"]

        # Hard gate: a leaky dataset must never be published, even partially.
        check_no_leakage(final_rows, AUDIT_TIMESTAMP_FIELDS)

        quality_report = build_quality_report(final_rows)
        splits, cutoffs = split_stage.time_based_split(final_rows)

        checksum = versioning.compute_checksum(final_rows)
        metadata = versioning.build_metadata(
            dataset_name=dataset_name,
            dataset_version=dataset_version,
            source_schema_version=source_schema_version,
            feature_version=_feature_version(),
            row_count=len(final_rows),
            checksum=checksum,
        )
        # Explicit isoformat() rather than leaving raw datetime objects in
        # metadata -- matches build_metadata's own createdAt formatting, so
        # every timestamp in the published metadata is a consistent,
        # already-JSON-safe string rather than relying on a json.dump(...,
        # default=str) fallback for some fields but not others.
        metadata["splitCutoffs"] = {
            key: (value.isoformat() if hasattr(value, "isoformat") else value) for key, value in cutoffs.items()
        }
        metadata["mode"] = mode

        observability["duration_ms"] = (time.monotonic() - start) * 1000

        version_dir = publish_dataset(dataset_dir, dataset_name, dataset_version, splits, metadata, quality_report, observability)

        if final_rows and max_prediction_time is not None:
            checkpoint.write_checkpoint(dataset_dir, dataset_name, max_prediction_time, dataset_version)

        log_event(
            "dataset_pipeline_complete",
            dataset=dataset_name,
            version=dataset_version,
            rowCount=len(final_rows),
            checksum=checksum,
            durationMs=observability["duration_ms"],
        )

        return {
            "metadata": metadata,
            "quality_report": quality_report,
            "observability": observability,
            "version_dir": version_dir,
            "splits": {name: len(rows) for name, rows in splits.items()},
        }
    finally:
        connection.close()


def _feature_version():
    from app.pipelines.features import FEATURE_VERSION

    return FEATURE_VERSION
