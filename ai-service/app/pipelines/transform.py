"""Phase 4G -- transform stage: joins a raw extracted application row with
its (pre-fetched, batch-level) connections and embeddings context, applies
temporal leakage masking, builds features, derives the label, and assembles
the final published row shape.
"""
from app.features.builder import FeatureBuilder
from app.pipelines.labels import derive_label

# Carried alongside every row for leakage.check_no_leakage(); stripped
# before publish (see publish.py) -- never part of the published schema.
AUDIT_TIMESTAMP_FIELDS = [
    "_audit_job_enrichment_created_at",
    "_audit_resume_enrichment_created_at",
]


def transform_row(raw_row, connections_by_user, embeddings_by_key):
    """`raw_row` is one dict from extract.APPLICATIONS_QUERY.
    `connections_by_user`/`embeddings_by_key` are the batch-level lookups
    from extract.fetch_connections_for_users / fetch_embeddings. Returns the
    final feature row dict (including the `_audit_*` fields, stripped later)."""
    prediction_time = raw_row["application_created_at"]

    # Retrieve features using unified FeatureBuilder
    builder = FeatureBuilder("opportunity-ranking", "v1")
    features = builder.build_features(raw_row, connections_by_user, embeddings_by_key)

    row = {
        "application_id": raw_row["application_id"],
        "user_id": raw_row["user_id"],
        "job_id": raw_row["job_id"],
        "company_id": raw_row["company_id"],
        "resume_id": raw_row.get("resume_id"),
        "prediction_time": prediction_time,

        # Merge central features
        **features,

        "application_status": raw_row["application_status"],
        "outcome_label": derive_label(raw_row["application_status"]),

        "_audit_job_enrichment_created_at": raw_row.get("job_enrichment_created_at"),
        "_audit_resume_enrichment_created_at": raw_row.get("resume_enrichment_created_at"),
    }
    return row

