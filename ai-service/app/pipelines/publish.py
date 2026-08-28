"""Phase 4G -- publish stage: writes an immutable dataset snapshot to disk
and logs its creation to MLflow (section 12).

Immutability (section 2): if the target version directory already exists
and has files in it, publish refuses to overwrite -- callers must pick a
new `--version`. This is a filesystem-level guarantee, not just a
convention.

MLflow artifacts are deliberately limited to `dataset-metadata.json`,
`feature-schema.json`, and `quality-report.json` -- never the row files
themselves, which stay purely local. This isn't an oversight: it's the
concrete enforcement of section 4's "do not upload private source
documents" and section 12's "do not upload sensitive raw data" for this
pipeline specifically.
"""
import json
import os

from app.pipelines.quality import EXPECTED_FIELDS
from app.tracking.mlflow_client import log_complete_run

AUDIT_FIELD_PREFIX = "_audit_"

FEATURE_SCHEMA = [
    {"name": "application_id", "type": "uuid", "description": "Pseudonymous row identifier (applications.id)."},
    {"name": "user_id", "type": "uuid", "description": "Pseudonymous applicant identifier."},
    {"name": "job_id", "type": "uuid", "description": "Job identifier."},
    {"name": "company_id", "type": "uuid", "description": "Company identifier."},
    {"name": "resume_id", "type": "uuid|null", "description": "Resume used, if any."},
    {"name": "prediction_time", "type": "timestamp", "description": "applications.created_at -- the point features are computed as-of."},
    {"name": "job_role_category", "type": "string|null", "description": "job_ai_enrichments.role_category, temporally masked."},
    {"name": "job_seniority", "type": "string|null", "description": "job_ai_enrichments.seniority, temporally masked."},
    {"name": "job_employment_type", "type": "string|null", "description": "jobs.employment_type."},
    {"name": "job_remote_type", "type": "string|null", "description": "jobs.remote_type."},
    {"name": "resume_career_level", "type": "string|null", "description": "resume_ai_enrichments.career_level, temporally masked."},
    {"name": "skill_overlap", "type": "float[0,1]|null", "description": "Jaccard overlap of job vs resume skills."},
    {"name": "domain_overlap", "type": "float[0,1]|null", "description": "Jaccard overlap of job vs resume technical domains."},
    {"name": "semantic_similarity", "type": "float[-1,1]|null", "description": "Cosine similarity of stored job/resume embeddings (same model only)."},
    {"name": "experience_compatibility", "type": "float[0,1]|null", "description": "Ordinal-rank compatibility of resume career_level vs job seniority."},
    {"name": "has_company_connection", "type": "float[0,1]|null", "description": "1.0 if the applicant has a known connection at the company."},
    {"name": "connection_relevance", "type": "float[0,1]|null", "description": "Weighted connection count/strength score at the company."},
    {"name": "application_status", "type": "string", "description": "applications.status at extraction time (label source)."},
    {"name": "outcome_label", "type": "int{0,1}|null", "description": "1=accepted, 0=rejected/withdrawn, null=outcome not yet known. See docs/dataset-versioning.md."},
]


def _strip_audit_fields(row):
    return {k: v for k, v in row.items() if not k.startswith(AUDIT_FIELD_PREFIX)}


def dataset_version_dir(dataset_dir, dataset_name, dataset_version):
    return os.path.join(dataset_dir, dataset_name, dataset_version)


def publish_dataset(dataset_dir, dataset_name, dataset_version, splits, metadata, quality_report, observability):
    """`splits` = {"train": [...], "validation": [...], "test": [...]}, each
    a list of transform.transform_row() output dicts (still carrying
    `_audit_*` fields, stripped here before writing). Returns the version
    directory path. Raises FileExistsError if that version was already
    published."""
    version_dir = dataset_version_dir(dataset_dir, dataset_name, dataset_version)
    if os.path.isdir(version_dir) and os.listdir(version_dir):
        raise FileExistsError(
            f"Dataset version already published and is immutable: {version_dir}. Use a different --version."
        )
    os.makedirs(version_dir, exist_ok=True)

    row_count = 0
    for split_name, rows in splits.items():
        path = os.path.join(version_dir, f"rows_{split_name}.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(_strip_audit_fields(row), default=str) + "\n")
        row_count += len(rows)

    with open(os.path.join(version_dir, "dataset-metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, default=str)

    with open(os.path.join(version_dir, "feature-schema.json"), "w", encoding="utf-8") as f:
        json.dump({"fields": FEATURE_SCHEMA, "expectedFieldNames": EXPECTED_FIELDS}, f, indent=2)

    with open(os.path.join(version_dir, "quality-report.json"), "w", encoding="utf-8") as f:
        json.dump(quality_report, f, indent=2, default=str)

    _log_to_mlflow(dataset_name, metadata, quality_report, observability)

    return version_dir


def _log_to_mlflow(dataset_name, metadata, quality_report, observability):
    """Best-effort; log_complete_run already never raises (Phase 4F
    failure-isolation guarantee) -- this wrapper exists only to keep the
    dataset-metadata/feature-schema/quality-report dicts as the exact
    artifact payloads, matching section 12 exactly."""
    log_complete_run(
        experiment_suffix="dataset-pipeline",
        run_name=f"{dataset_name}-{metadata['datasetVersion']}",
        params={
            "datasetName": metadata["datasetName"],
            "datasetVersion": metadata["datasetVersion"],
            "sourceSchemaVersion": metadata["sourceSchemaVersion"],
            "featureVersion": metadata["featureVersion"],
        },
        metrics={
            "rowCount": metadata["rowCount"],
            "rows_processed": observability.get("rows_processed", 0),
            "rows_accepted": observability.get("rows_accepted", 0),
            "rows_rejected": observability.get("rows_rejected", 0),
            "duration_ms": observability.get("duration_ms", 0),
            "feature_generation_ms": observability.get("feature_generation_ms", 0),
            "failure_count": observability.get("failure_count", 0),
        },
        tags={
            "checksum": metadata["checksum"],
            "gitCommit": metadata["gitCommit"],
            "datasetHealthy": quality_report.get("healthy"),
        },
        artifacts=[
            {"name": "dataset-metadata.json", "content": metadata},
            {"name": "feature-schema.json", "content": {"fields": FEATURE_SCHEMA, "expectedFieldNames": EXPECTED_FIELDS}},
            {"name": "quality-report.json", "content": quality_report},
        ],
    )
